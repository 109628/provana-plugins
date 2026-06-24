---
name: databricks-patterns
description: >
  Databricks workspace — Delta Lake tables, notebooks, jobs, clusters, Unity Catalog,
  Spark optimization. Use when building or debugging Databricks pipelines, Delta tables,
  job orchestration, or when working with the Databricks MCP server.
---

# Databricks Patterns

## MCP Tools (after provana-data installed)

The `databricks` MCP gives Claude direct access to your workspace:

```
"List all Delta tables in catalog provana.gold schema"
"Show the schema and row count of provana.silver.call_events"
"Run this SQL query on the cluster"
"Show failed job runs from the last 24 hours"
"What notebooks reference the call_events table?"
```

**Prerequisite:** Databricks CLI configured:
```bash
databricks configure --host https://<workspace>.azuredatabricks.net --token <PAT>
```

---

## Delta Lake Table Standards

### Naming Convention
```
<catalog>.<schema>.<table>

catalog:  provana
schemas:  bronze  → raw ingested data
          silver  → cleaned, validated
          gold    → business-ready aggregates

Examples:
  provana.bronze.call_events_raw
  provana.silver.call_events
  provana.gold.agent_performance_daily
```

### Table Creation
```python
# Always use Delta format, managed tables in Unity Catalog
spark.sql("""
  CREATE TABLE IF NOT EXISTS provana.silver.call_events (
    event_id     STRING NOT NULL,
    call_id      STRING NOT NULL,
    agent_id     STRING NOT NULL,
    event_type   STRING NOT NULL,
    occurred_at  TIMESTAMP NOT NULL,
    payload      MAP<STRING, STRING>,
    _ingested_at TIMESTAMP DEFAULT current_timestamp(),
    _source_file STRING
  )
  USING DELTA
  PARTITIONED BY (date(occurred_at))
  TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact' = 'true'
  )
""")
```

### MERGE (upsert) pattern
```python
from delta.tables import DeltaTable

target = DeltaTable.forName(spark, "provana.silver.call_events")

target.alias("t").merge(
    source=source_df.alias("s"),
    condition="t.event_id = s.event_id"
).whenMatchedUpdateAll(
    condition="t._ingested_at < s._ingested_at"  # only update if newer
).whenNotMatchedInsertAll(
).execute()
```

---

## Notebook Patterns

### Standard notebook header
```python
# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline: Silver Call Events
# MAGIC **Owner:** data-engineering  
# MAGIC **Schedule:** Every 15 minutes  
# MAGIC **Upstream:** bronze.call_events_raw  
# MAGIC **Downstream:** gold.agent_performance_daily

# COMMAND ----------
dbutils.widgets.text("start_date", "", "Start Date (YYYY-MM-DD)")
dbutils.widgets.text("end_date", "", "End Date (YYYY-MM-DD)")

start_date = dbutils.widgets.get("start_date")
end_date   = dbutils.widgets.get("end_date")
```

### Incremental load pattern
```python
# Always incremental — never full reload unless explicitly needed
last_processed = spark.sql("""
  SELECT COALESCE(MAX(_ingested_at), '1970-01-01') as checkpoint
  FROM provana.silver.call_events
""").collect()[0]["checkpoint"]

new_data = spark.sql(f"""
  SELECT * FROM provana.bronze.call_events_raw
  WHERE _ingested_at > '{last_processed}'
""")

print(f"Processing {new_data.count()} new records since {last_processed}")
```

---

## Job Orchestration

### Job structure (use Databricks Workflows, not Airflow)
```
Pipeline: call_events_pipeline
├── Task 1: ingest_bronze      (runs every 15min, trigger: file arrival)
├── Task 2: process_silver     (depends on Task 1)
├── Task 3: aggregate_gold     (depends on Task 2, runs hourly)
└── Task 4: data_quality_check (depends on Task 3, alerts on failure)
```

### Retry policy (set on every task)
```json
{
  "max_retries": 2,
  "min_retry_interval_millis": 60000,
  "retry_on_timeout": true,
  "timeout_seconds": 3600
}
```

---

## Spark Optimization

### Anti-patterns to avoid
```python
# WRONG — collect on large dataset
all_rows = large_df.collect()  # OOM risk

# WRONG — UDF when built-in exists
@udf(StringType())
def upper(s): return s.upper()  # use F.upper() instead

# WRONG — repartition before write (causes small files)
df.repartition(200).write.delta.save(path)

# CORRECT — coalesce + autoOptimize handles it
df.coalesce(8).write.format("delta").mode("append").saveAsTable("provana.silver.x")
```

### Partition strategy
- Partition by `date(event_timestamp)` for time-series data
- Target partition size: 128MB–1GB
- Never partition by high-cardinality columns (agent_id, call_id)
- Use `ZORDER BY` for high-cardinality filter columns:
```sql
OPTIMIZE provana.silver.call_events ZORDER BY (agent_id, call_id);
```

---

## Unity Catalog Governance

```sql
-- Grant read to analysts
GRANT SELECT ON TABLE provana.gold.agent_performance_daily TO `analysts@provana.com`;

-- Grant write to pipeline service principal
GRANT MODIFY ON SCHEMA provana.silver TO `data-pipeline-sp`;

-- Tag sensitive columns
ALTER TABLE provana.silver.call_events
  ALTER COLUMN phone_number SET TAGS ('pii' = 'true', 'fdcpa_sensitive' = 'true');
```

---

## Databricks CLI Cheatsheet

```bash
# List clusters
databricks clusters list

# Run a job
databricks jobs run-now --job-id 12345

# Check job run status
databricks runs get --run-id 98765

# Upload notebook
databricks workspace import notebook.py /Shared/pipelines/notebook --language PYTHON

# Query via SQL warehouse
databricks sql execute --statement "SELECT count(*) FROM provana.gold.agent_performance_daily"
```
