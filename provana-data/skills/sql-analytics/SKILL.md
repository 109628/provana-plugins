---
name: sql-analytics
description: >
  Advanced SQL for analytics — window functions, CTEs, query optimization, Spark SQL
  patterns, PostgreSQL analytics queries. Use when writing complex analytical queries,
  optimizing slow queries, building reports, or working with large datasets in Databricks
  or PostgreSQL.
---

# SQL Analytics Patterns

## Window Functions (most powerful analytics tool)

### Running totals and moving averages
```sql
SELECT
  agent_id,
  call_date,
  calls_handled,
  -- Running total
  SUM(calls_handled) OVER (
    PARTITION BY agent_id
    ORDER BY call_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_calls,
  -- 7-day moving average
  AVG(calls_handled) OVER (
    PARTITION BY agent_id
    ORDER BY call_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS calls_7day_avg,
  -- Day-over-day change
  calls_handled - LAG(calls_handled, 1) OVER (
    PARTITION BY agent_id ORDER BY call_date
  ) AS day_over_day_change
FROM provana.gold.agent_performance_daily;
```

### Ranking
```sql
SELECT
  agent_id,
  agent_name,
  total_calls,
  RANK()        OVER (ORDER BY total_calls DESC) AS rank,         -- gaps on ties
  DENSE_RANK()  OVER (ORDER BY total_calls DESC) AS dense_rank,   -- no gaps
  ROW_NUMBER()  OVER (ORDER BY total_calls DESC) AS row_num,      -- always unique
  NTILE(4)      OVER (ORDER BY total_calls DESC) AS quartile,     -- 1=top, 4=bottom
  PERCENT_RANK() OVER (ORDER BY total_calls) AS percentile        -- 0.0 to 1.0
FROM agent_summary;
```

### First/last value per group
```sql
-- First and last call of each agent per day
SELECT DISTINCT
  agent_id,
  call_date,
  FIRST_VALUE(started_at) OVER (
    PARTITION BY agent_id, call_date
    ORDER BY started_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS first_call,
  LAST_VALUE(started_at) OVER (
    PARTITION BY agent_id, call_date
    ORDER BY started_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS last_call
FROM provana.silver.call_events
WHERE event_type = 'started';
```

### Session analysis (gap and island)
```sql
-- Group consecutive calls into sessions (gap > 30 min = new session)
WITH call_gaps AS (
  SELECT
    agent_id,
    started_at,
    LAG(ended_at) OVER (PARTITION BY agent_id ORDER BY started_at) AS prev_end,
    CASE
      WHEN started_at - LAG(ended_at) OVER (PARTITION BY agent_id ORDER BY started_at)
           > INTERVAL 30 MINUTES
      THEN 1 ELSE 0
    END AS is_new_session
  FROM provana.silver.calls
),
sessions AS (
  SELECT *,
    SUM(is_new_session) OVER (PARTITION BY agent_id ORDER BY started_at) AS session_id
  FROM call_gaps
)
SELECT
  agent_id,
  session_id,
  MIN(started_at) AS session_start,
  MAX(ended_at)   AS session_end,
  COUNT(*)        AS calls_in_session
FROM sessions
GROUP BY agent_id, session_id;
```

---

## CTEs (Common Table Expressions)

### Readable multi-step analysis
```sql
WITH
-- Step 1: daily call volumes per agent
daily_volumes AS (
  SELECT
    agent_id,
    date(started_at) AS call_date,
    COUNT(*) AS total_calls,
    AVG(duration_seconds) AS avg_duration,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_calls
  FROM provana.silver.calls
  WHERE started_at >= current_date() - 30
  GROUP BY agent_id, date(started_at)
),

-- Step 2: baseline per agent (last 30 days)
agent_baselines AS (
  SELECT
    agent_id,
    AVG(total_calls) AS avg_daily_calls,
    STDDEV(total_calls) AS std_daily_calls
  FROM daily_volumes
  GROUP BY agent_id
),

-- Step 3: identify underperforming days
performance_flags AS (
  SELECT
    v.*,
    b.avg_daily_calls,
    (v.total_calls - b.avg_daily_calls) / NULLIF(b.std_daily_calls, 0) AS z_score
  FROM daily_volumes v
  JOIN agent_baselines b USING (agent_id)
)

SELECT *
FROM performance_flags
WHERE z_score < -2  -- more than 2 std devs below average
ORDER BY call_date DESC, z_score;
```

---

## Query Optimization (Databricks / Spark SQL)

### Avoid these patterns
```sql
-- SLOW: non-equi join
SELECT * FROM calls c JOIN agents a ON c.agent_id != a.id  -- cartesian-ish

-- SLOW: SELECT * on wide table
SELECT * FROM provana.silver.calls  -- fetches all 50 columns

-- SLOW: count distinct on huge dataset (use approx)
SELECT COUNT(DISTINCT call_id) FROM provana.silver.call_events  -- exact = slow

-- SLOW: function on filter column (disables partition pruning)
WHERE year(started_at) = 2026  -- doesn't use date partitioning

-- SLOW: HAVING without GROUP BY
SELECT agent_id FROM calls HAVING count(*) > 100  -- use WHERE subquery
```

### Use these instead
```sql
-- FAST: only select needed columns
SELECT call_id, agent_id, duration_seconds, status FROM provana.silver.calls

-- FAST: approx count distinct (within 5% error)
SELECT APPROX_COUNT_DISTINCT(call_id) FROM provana.silver.call_events

-- FAST: partition pruning via range on partition column
WHERE started_at >= '2026-01-01' AND started_at < '2026-02-01'

-- FAST: broadcast join for small lookup tables (< 10MB)
SELECT /*+ BROADCAST(a) */ c.*, a.agent_name
FROM provana.silver.calls c
JOIN provana.gold.agents a ON c.agent_id = a.id
```

### Check query plan
```sql
EXPLAIN EXTENDED
SELECT agent_id, count(*) FROM provana.silver.calls
WHERE started_at >= '2026-01-01'
GROUP BY agent_id;
-- Look for: FileScan (partition pruning), Exchange (shuffle = expensive), BroadcastHashJoin (good)
```

---

## Provana-Specific Analytical Patterns

### Agent performance report
```sql
SELECT
  a.agent_name,
  a.team,
  COUNT(c.call_id)                                       AS total_calls,
  ROUND(AVG(c.duration_seconds) / 60, 1)                AS avg_duration_mins,
  ROUND(100.0 * SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) AS completion_rate_pct,
  ROUND(AVG(c.after_call_work_seconds) / 60, 1)         AS avg_acw_mins,
  COUNT(DISTINCT DATE(c.started_at))                     AS days_active
FROM provana.silver.calls c
JOIN provana.gold.agents a ON c.agent_id = a.id
WHERE c.started_at >= current_date() - INTERVAL 7 DAYS
GROUP BY a.agent_name, a.team
ORDER BY total_calls DESC;
```

### Hourly call distribution (for workforce planning)
```sql
SELECT
  HOUR(started_at)               AS hour_of_day,
  DAYOFWEEK(started_at)          AS day_of_week,  -- 1=Sun, 7=Sat
  COUNT(*)                       AS call_volume,
  AVG(duration_seconds)          AS avg_duration,
  PERCENTILE(duration_seconds, 0.9) AS p90_duration
FROM provana.silver.calls
WHERE started_at >= current_date() - 90
GROUP BY HOUR(started_at), DAYOFWEEK(started_at)
ORDER BY day_of_week, hour_of_day;
```

### Cohort retention (contact re-engagement)
```sql
WITH first_contact AS (
  SELECT contact_id, MIN(DATE(started_at)) AS cohort_date
  FROM provana.silver.calls
  GROUP BY contact_id
),
contact_activity AS (
  SELECT
    c.contact_id,
    fc.cohort_date,
    DATE_DIFF(DATE(c.started_at), fc.cohort_date, WEEK) AS weeks_since_first
  FROM provana.silver.calls c
  JOIN first_contact fc ON c.contact_id = fc.contact_id
)
SELECT
  cohort_date,
  weeks_since_first,
  COUNT(DISTINCT contact_id) AS contacts_active,
  ROUND(100.0 * COUNT(DISTINCT contact_id) /
    FIRST_VALUE(COUNT(DISTINCT contact_id)) OVER (PARTITION BY cohort_date ORDER BY weeks_since_first), 1
  ) AS retention_pct
FROM contact_activity
GROUP BY cohort_date, weeks_since_first
ORDER BY cohort_date, weeks_since_first;
```

---

## PostgreSQL-Specific Extras

```sql
-- Explain analyze (actual execution stats)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM calls WHERE agent_id = 'agent-123';

-- Index usage check
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- indexes never used = candidates for removal
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table bloat check
SELECT tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS total_size,
  pg_size_pretty(pg_relation_size(tablename::regclass)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```
