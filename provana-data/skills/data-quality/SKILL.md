---
name: data-quality
description: >
  Data quality — freshness checks, completeness validation, anomaly detection,
  Delta table constraints, row-level expectations. Use when building data validation
  pipelines, setting up quality monitoring, writing SLA checks, or debugging data
  issues in the lakehouse.
---

# Data Quality Patterns

## Quality Dimensions (check all for critical tables)

| Dimension | Question | How to check |
|---|---|---|
| Freshness | Is data recent enough? | MAX(event_time) vs now() |
| Completeness | Are required fields populated? | NULL counts on NOT NULL columns |
| Uniqueness | Are primary keys unique? | COUNT vs COUNT DISTINCT |
| Validity | Are values in expected range/format? | Regex, range checks |
| Consistency | Does data agree across tables? | Referential integrity checks |
| Volume | Is row count within expected range? | Compare to 7-day rolling avg |

---

## Delta Table Constraints (enforce at write time)

```sql
-- Add constraints to Delta table (rejected at write, not just flagged)
ALTER TABLE provana.silver.call_events
  ADD CONSTRAINT valid_event_type
  CHECK (event_type IN ('started', 'ended', 'transferred', 'abandoned'));

ALTER TABLE provana.silver.call_events
  ADD CONSTRAINT phone_not_null
  CHECK (phone IS NOT NULL AND length(phone) >= 10);

ALTER TABLE provana.silver.agents
  ADD CONSTRAINT valid_status
  CHECK (status IN ('active', 'inactive', 'suspended'));

-- List existing constraints
DESCRIBE DETAIL provana.silver.call_events;
```

---

## Inline Quality Checks (in pipeline notebooks)

```python
from pyspark.sql import functions as F
from dataclasses import dataclass
from typing import Callable
import json

@dataclass
class QualityCheck:
    name: str
    table: str
    query: str
    threshold: float       # fail if metric BELOW this
    severity: str          # "error" = stop pipeline, "warning" = alert only

CHECKS = [
    QualityCheck(
        name="calls_freshness",
        table="provana.silver.call_events",
        query="SELECT (unix_timestamp() - unix_timestamp(max(occurred_at))) / 60 as lag_minutes FROM provana.silver.call_events",
        threshold=30,       # fail if lag > 30 minutes (inverted: fail if value > threshold)
        severity="error"
    ),
    QualityCheck(
        name="calls_no_null_agent",
        table="provana.silver.call_events",
        query="SELECT 100.0 * sum(case when agent_id is null then 1 else 0 end) / count(*) as null_pct FROM provana.silver.call_events WHERE date(occurred_at) = current_date()",
        threshold=1.0,      # fail if null_pct > 1%
        severity="error"
    ),
    QualityCheck(
        name="calls_volume_anomaly",
        table="provana.silver.call_events",
        query="""
          SELECT
            abs(today_count - avg_count) / avg_count * 100 as pct_deviation
          FROM (
            SELECT count(*) as today_count FROM provana.silver.call_events WHERE date(occurred_at) = current_date()
          ), (
            SELECT avg(daily_count) as avg_count FROM (
              SELECT date(occurred_at), count(*) as daily_count
              FROM provana.silver.call_events
              WHERE occurred_at >= current_date() - 7
              GROUP BY 1
            )
          )
        """,
        threshold=50.0,     # fail if >50% deviation from 7-day avg
        severity="warning"
    ),
]

def run_quality_checks(checks: list[QualityCheck]) -> dict:
    results = {"passed": [], "warnings": [], "errors": []}

    for check in checks:
        value = spark.sql(check.query).collect()[0][0]

        if value is None:
            results["errors"].append(f"{check.name}: query returned null")
            continue

        failed = value > check.threshold  # most checks: fail if exceeds threshold
        status = "pass" if not failed else check.severity

        result = {"check": check.name, "value": round(float(value), 2), "threshold": check.threshold}

        if status == "pass":
            results["passed"].append(result)
        elif status == "warning":
            results["warnings"].append(result)
            print(f"⚠️  WARNING {check.name}: {value:.2f} (threshold: {check.threshold})")
        else:
            results["errors"].append(result)
            print(f"❌ ERROR {check.name}: {value:.2f} (threshold: {check.threshold})")

    return results

results = run_quality_checks(CHECKS)

# Write results to quality log table
dbutils.notebook.exit(json.dumps(results))

# Fail pipeline if any errors
if results["errors"]:
    raise Exception(f"Quality gate failed: {results['errors']}")
```

---

## Quality Results Table

```sql
-- Store all check results for trending and alerting
CREATE TABLE IF NOT EXISTS provana.gold.data_quality_results (
  check_name    STRING NOT NULL,
  table_name    STRING NOT NULL,
  metric_value  DOUBLE,
  threshold     DOUBLE,
  status        STRING,    -- 'pass', 'warning', 'error'
  pipeline_run  STRING,
  checked_at    TIMESTAMP DEFAULT current_timestamp()
)
USING DELTA
PARTITIONED BY (date(checked_at));
```

---

## Freshness SLA Definitions

| Table | Max acceptable lag | Severity if breached |
|---|---|---|
| `silver.call_events` | 30 minutes | Error — pipeline alert |
| `silver.agents` | 4 hours | Warning |
| `gold.agent_performance_daily` | 2 hours after midnight | Error |
| `gold.campaign_summary` | 24 hours | Warning |

```python
# Freshness check query pattern
spark.sql(f"""
  SELECT
    '{table}' as table_name,
    max(occurred_at) as last_event,
    current_timestamp() as checked_at,
    (unix_timestamp() - unix_timestamp(max(occurred_at))) / 60 as lag_minutes,
    CASE
      WHEN (unix_timestamp() - unix_timestamp(max(occurred_at))) / 60 > {sla_minutes}
      THEN 'BREACH'
      ELSE 'OK'
    END as sla_status
  FROM {table}
""")
```

---

## Anomaly Detection (volume-based)

```python
def check_volume_anomaly(table: str, date_col: str, lookback_days: int = 14, threshold_pct: float = 40) -> bool:
    stats = spark.sql(f"""
      WITH daily AS (
        SELECT date({date_col}) as dt, count(*) as cnt
        FROM {table}
        WHERE {date_col} >= current_date() - {lookback_days}
        GROUP BY 1
      ),
      baseline AS (
        SELECT avg(cnt) as avg_cnt, stddev(cnt) as std_cnt
        FROM daily
        WHERE dt < current_date()
      )
      SELECT
        d.cnt as today,
        b.avg_cnt as baseline_avg,
        abs(d.cnt - b.avg_cnt) / b.avg_cnt * 100 as pct_deviation,
        abs(d.cnt - b.avg_cnt) / nullif(b.std_cnt, 0) as z_score
      FROM daily d, baseline b
      WHERE d.dt = current_date()
    """).collect()

    if not stats: return False
    row = stats[0]
    anomaly = row.pct_deviation > threshold_pct or (row.z_score and row.z_score > 3)
    if anomaly:
        print(f"⚠️ Volume anomaly in {table}: today={row.today}, baseline={row.baseline_avg:.0f}, deviation={row.pct_deviation:.1f}%")
    return anomaly
```

---

## Alerting

```python
import requests

def alert_teams(message: str, severity: str = "warning"):
    """Send to Microsoft Teams channel via webhook."""
    webhook_url = dbutils.secrets.get(scope="provana", key="teams-data-alerts-webhook")
    color = "FF0000" if severity == "error" else "FFA500"

    payload = {
        "@type": "MessageCard",
        "themeColor": color,
        "summary": "Data Quality Alert",
        "sections": [{"activityTitle": f"Data Quality {severity.upper()}", "text": message}]
    }
    requests.post(webhook_url, json=payload, timeout=10)
```
