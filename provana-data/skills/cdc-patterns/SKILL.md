---
name: cdc-patterns
description: >
  Change Data Capture — Debezium setup, Delta Lake CDC, streaming ingestion from
  PostgreSQL/SQL Server, schema evolution, exactly-once semantics. Use when
  implementing real-time data sync, event-driven pipelines, or streaming ingestion
  from operational databases into the lakehouse.
---

# CDC Patterns (Change Data Capture)

## Architecture Overview

```
Operational DB (PostgreSQL/SQL Server)
    ↓ WAL / transaction log
Debezium (Kafka Connect)
    ↓ Kafka topics (one per table)
Spark Structured Streaming (Databricks)
    ↓ MERGE into Delta Lake
provana.bronze.<table>_cdc  →  provana.silver.<table>
```

---

## PostgreSQL → Debezium Setup

### Enable WAL on PostgreSQL
```sql
-- postgresql.conf
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10

-- Create replication slot
SELECT pg_create_logical_replication_slot('debezium_slot', 'pgoutput');

-- Grant replication to service user
ALTER ROLE debezium_user REPLICATION LOGIN;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO debezium_user;
```

### Debezium connector config
```json
{
  "name": "provana-postgres-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "provana-postgres.database.azure.com",
    "database.port": "5432",
    "database.user": "debezium_user",
    "database.password": "${DB_PASSWORD}",
    "database.dbname": "provana_db",
    "database.server.name": "provana",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "table.include.list": "public.calls,public.agents,public.contacts",
    "publication.name": "debezium_publication",
    "tombstones.on.delete": "false",
    "decimal.handling.mode": "string",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.add.fields": "op,ts_ms,source.table",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```

### Kafka topic structure (auto-created)
```
provana.public.calls       ← one message per row change
provana.public.agents
provana.public.contacts
```

---

## Delta Lake CDC Streaming (Databricks)

### Enable CDF on target table
```sql
ALTER TABLE provana.silver.calls
SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');
```

### Streaming ingestion from Kafka
```python
from pyspark.sql import functions as F
from pyspark.sql.types import *
from delta.tables import DeltaTable

# Schema for Debezium unwrapped message
call_schema = StructType([
    StructField("id",         StringType(),    False),
    StructField("agent_id",   StringType(),    True),
    StructField("phone",      StringType(),    True),
    StructField("status",     StringType(),    True),
    StructField("started_at", TimestampType(), True),
    StructField("ended_at",   TimestampType(), True),
    StructField("__op",       StringType(),    True),   # c=create, u=update, d=delete
    StructField("__ts_ms",    LongType(),      True),
])

raw_stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "provana-kafka.servicebus.windows.net:9093")
    .option("subscribe", "provana.public.calls")
    .option("startingOffsets", "latest")
    .option("kafka.security.protocol", "SASL_SSL")
    .load()
)

parsed = (
    raw_stream
    .select(F.from_json(F.col("value").cast("string"), call_schema).alias("data"))
    .select("data.*")
    .withColumn("_cdc_ts", F.from_unixtime(F.col("__ts_ms") / 1000).cast(TimestampType()))
)

def upsert_to_delta(batch_df, batch_id):
    if batch_df.isEmpty(): return

    target = DeltaTable.forName(spark, "provana.silver.calls")

    # Handle deletes separately
    deletes = batch_df.filter(F.col("__op") == "d")
    upserts = batch_df.filter(F.col("__op").isin("c", "u"))

    if not upserts.isEmpty():
        (target.alias("t")
         .merge(upserts.alias("s"), "t.id = s.id")
         .whenMatchedUpdateAll()
         .whenNotMatchedInsertAll()
         .execute())

    if not deletes.isEmpty():
        target.delete(F.col("id").isin([r.id for r in deletes.collect()]))

query = (
    parsed.writeStream
    .foreachBatch(upsert_to_delta)
    .option("checkpointLocation", "/mnt/checkpoints/calls_cdc")
    .trigger(processingTime="30 seconds")
    .start()
)
```

---

## Schema Evolution

### Safe changes (no action needed)
- Adding a nullable column
- Widening a column type (INT → BIGINT)

### Breaking changes (require coordination)
- Renaming a column
- Changing column type incompatibly
- Dropping a column

### Handling schema evolution in streaming
```python
# Enable schema evolution on Delta write
spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")

# Or per-write
df.write.option("mergeSchema", "true").format("delta").mode("append").saveAsTable(...)
```

### Debezium schema change event
When source schema changes, Debezium emits a schema change event before data events.
The Spark streaming job should:
1. Detect schema change events (message key = null in some configs)
2. Pause stream
3. Apply schema migration to Delta table
4. Resume stream

---

## Exactly-Once Semantics

```python
# Kafka idempotent producer (set on Debezium connector)
"producer.enable.idempotence": "true"
"producer.acks": "all"
"producer.max.in.flight.requests.per.connection": "1"

# Spark checkpointing (NEVER skip this)
.option("checkpointLocation", "/mnt/checkpoints/<unique-per-stream>")

# Delta MERGE is idempotent by nature — safe to replay
```

---

## Monitoring CDC Pipeline

```python
# Check stream lag
spark.sql("""
  SELECT
    topic,
    partition,
    latest_offset - current_offset AS lag_messages
  FROM (
    SELECT topic, partition,
           max(offset) as latest_offset,
           max(processed_offset) as current_offset
    FROM provana.bronze.kafka_offsets
    GROUP BY topic, partition
  )
""")

# Check CDC freshness
spark.sql("""
  SELECT
    'calls' as table_name,
    max(_cdc_ts) as last_event_time,
    current_timestamp() - max(_cdc_ts) as lag
  FROM provana.silver.calls
""")
```

---

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| Replication slot bloat | Consumer fell behind, slot retaining WAL | Increase consumer throughput or `max_slot_wal_keep_size` |
| Duplicate events | Kafka at-least-once + no idempotent consumer | Use MERGE (not INSERT) in Spark |
| Schema mismatch | Source schema changed before consumer updated | Enable `mergeSchema`, handle schema change events |
| OOM on Spark executor | Large batch from Kafka | Add `.trigger(processingTime="60 seconds")` to throttle |
| Checkpoint corruption | Cluster killed mid-write | Delete checkpoint dir, restart from last committed offset |
