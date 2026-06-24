---
name: azure-cloud-design
description: Use when designing or reviewing any Azure-based architecture — service selection across Event Hub/Grid, Service Bus, Functions, Cosmos DB, AI Search, AKS/Container Apps. Trigger on "azure architecture", "azure design", "what azure service", "design this on azure".
---

# Azure Cloud Architecture Design

General-purpose Azure cloud architecture skill. Works for any project — not Provana-specific. Produces architecture decisions, service selection rationale, and implementation-ready design documents.

**Announce at start:** "Running azure-cloud-design. Starting architecture analysis."

## Design approach

Architecture decisions are made from first principles, not defaults. Before recommending any Azure service, establish:

1. **Throughput requirements**: events/sec, messages/day, concurrent users
2. **Latency requirements**: real-time (<100ms), near-real-time (<1s), batch (minutes)
3. **Ordering requirements**: strict FIFO, partition-level, or unordered
4. **Durability requirements**: at-least-once, exactly-once, best-effort
5. **Consumer model**: push (trigger), pull (competing consumers), fan-out (broadcast)
6. **Scale pattern**: predictable load, bursty, unpredictable
7. **Cost sensitivity**: per-message pricing vs reserved capacity

---

## Azure Messaging and Eventing — Service Selection

### Decision tree

```
Is the payload > 1MB?
  Yes → Blob Storage + reference message (Event Hub / Service Bus)
  No  →
    Is this an event (something happened) or a command (do this)?
      Event →
        Is it high-throughput telemetry / streaming? (>1k events/sec)
          Yes → Azure Event Hub
          No  →
            Does it need routing / filtering by event type?
              Yes → Azure Event Grid
              No  → Azure Event Hub (simpler)
      Command →
        Does it need ordering guarantees or sessions?
          Yes → Azure Service Bus (Standard/Premium)
          No  →
            Is it a simple work queue?
              Yes → Azure Storage Queue (cheapest)
              No  → Azure Service Bus
```

### Service comparison matrix

| Requirement | Event Hub | Event Grid | Service Bus | Storage Queue |
|-------------|-----------|------------|-------------|---------------|
| Max throughput | 1M events/sec | 10M events/sec | ~2k msg/sec | ~2k msg/sec |
| Max message size | 1MB | 1.5MB | 256KB (Standard) / 100MB (Premium) | 64KB |
| Ordering | Partition-level | No | FIFO / sessions | FIFO (approx) |
| Dead-letter queue | No (capture to ADLS) | Yes (storage) | Yes (native) | No |
| TTL / scheduled delivery | No | No | Yes | Yes |
| Competing consumers | Yes (consumer groups) | No (push only) | Yes | Yes |
| Fan-out (broadcast) | Yes (consumer groups) | Yes (subscriptions) | Yes (topics) | No |
| Replay | Yes (retention 1–7 days) | No | No | No |
| Protocol | AMQP, Kafka, HTTPS | HTTPS/webhooks | AMQP, HTTPS | HTTPS, REST |
| Typical use | Telemetry, log ingestion, streaming ML | Cloud events, serverless triggers | Enterprise messaging, workflows | Simple task queues |
| AI/ML integration | Kafka-compatible → Spark/Databricks | Triggers Azure Functions / Logic Apps | Durable workflows | Simplest trigger |

---

## Azure Event Hub — Design Patterns

### Partition design

```
Rule of thumb: partitions = max_consumers × 2
- 2 partitions: dev / low scale
- 8 partitions: most production workloads
- 32 partitions: high throughput (requires Standard tier)

Partition key selection:
  - Use a key that distributes load evenly (device ID, user ID, tenant ID)
  - Events with the same partition key always go to the same partition → enables ordering per key
  - Avoid hot partitions: don't use timestamp or sequential IDs as partition key
```

### Consumer group pattern

```
One consumer group per independent downstream system:
  - consumer-group-analytics        → Azure Stream Analytics
  - consumer-group-ml-pipeline      → Azure Functions / custom consumer
  - consumer-group-audit-log        → Azure Data Explorer / ADLS

Each consumer group maintains its own offset — no interference between consumers.
```

### Capture + replay architecture

```
Event Hub
    │
    ├──▶ Real-time consumer (Azure Functions / Stream Analytics)
    │
    └──▶ Capture to ADLS Gen2 (Avro format)
              │
              └──▶ Replay via Event Hub SDK (reprocess historical events)
                   Azure Data Factory (batch analytics)
                   Azure Synapse (ad-hoc analysis)
```

### Event Hub Kafka surface

When migrating from Kafka or using Kafka clients:
```python
# Connect Kafka producer to Event Hub
config = {
    'bootstrap.servers': '[namespace].servicebus.windows.net:9093',
    'security.protocol': 'SASL_SSL',
    'sasl.mechanism': 'PLAIN',
    'sasl.username': '$ConnectionString',
    'sasl.password': '[connection-string]',
}
# Topic name = Event Hub name
# Consumer group = Event Hub consumer group
```

---

## Azure Event Grid — Design Patterns

### Event routing architecture

```
Event sources (publishers):
  - Azure Blob Storage (BlobCreated, BlobDeleted)
  - Azure Resource Manager (resource changes)
  - Custom topics (your application events)
  - Event Hub (Capture file created)

Event Grid (routing + filtering)
    │
    ├── filter: eventType = "BlobCreated", subject endsWith ".pdf"
    │      └──▶ Azure Function: doc-ai-ingest-trigger
    │
    ├── filter: eventType = "BlobCreated", subject endsWith ".wav"
    │      └──▶ Azure Function: conv-ai-audio-trigger
    │
    └── filter: eventType = "custom.ProcessComplete"
           └──▶ Logic App: stakeholder-notification
```

### Custom topic + schema

```json
{
  "id": "[uuid]",
  "eventType": "provana.extraction.complete",
  "subject": "/doc-ai/pipelines/invoice/[job-id]",
  "eventTime": "2026-05-12T10:00:00Z",
  "data": {
    "jobId": "[job-id]",
    "documentType": "invoice",
    "status": "success",
    "accuracy": 0.94,
    "outputUri": "https://[storage]/output/[job-id].json"
  },
  "dataVersion": "1.0"
}
```

### Dead-letter and retry policy

```
Event Grid subscription settings:
  maxDeliveryAttempts: 30        # retries over 24h
  eventTimeToLiveInMinutes: 1440 # 24h TTL
  deadLetterDestination:
    endpointType: StorageBlob
    resourceId: [storage-account-id]
    blobContainerName: dead-letter-events
```

---

## Azure Service Bus — Design Patterns

### Topic + subscription pattern (fan-out with filtering)

```
Service Bus Topic: process-events
    │
    ├── Subscription: compliance-team
    │     Filter: eventType = 'SOP.Completed' AND complianceRequired = true
    │
    ├── Subscription: analytics
    │     Filter: ALL (no filter — receives everything)
    │
    └── Subscription: alerts
          Filter: eventType = 'SOP.Exception'
```

### Session-enabled queue (ordered processing per entity)

```python
# Send with session ID = case ID → guarantees ordered processing per case
sender.send_messages(
    ServiceBusMessage(
        body=json.dumps(payload),
        session_id=case_id,  # All messages for this case go to same session
        message_id=str(uuid4())
    )
)

# Receiver accepts sessions → processes one case at a time
receiver = client.get_queue_receiver(
    queue_name="bpm-case-queue",
    session_id=case_id,
    receive_mode=ServiceBusReceiveMode.PEEK_LOCK
)
```

### Dead-letter queue handling

```python
# Monitor dead-letter queue in all production deployments
dlq_receiver = client.get_queue_receiver(
    queue_name="[queue-name]/$DeadLetterQueue"
)

for msg in dlq_receiver:
    reason = msg.dead_letter_reason        # Why it was DLQ'd
    error = msg.dead_letter_error_description
    # Log, alert, and remediate
    dlq_receiver.dead_letter_message(msg)  # or complete after reprocessing
```

---

## Azure Functions — Trigger Design

### Trigger selection

| Trigger type | Use when |
|-------------|---------|
| Event Hub trigger | High-throughput event processing, streaming ML |
| Event Grid trigger | Cloud event reactions, low-latency serverless |
| Service Bus trigger | Reliable command processing, workflows |
| Blob trigger | Document processing on upload |
| Timer trigger | Scheduled batch jobs, health checks |
| HTTP trigger | API endpoints, webhooks |
| Cosmos DB trigger | Change feed processing |

### Idempotency pattern (critical for at-least-once delivery)

```python
# All Azure Function event handlers must be idempotent
async def process_event(event: EventGridEvent):
    event_id = event.id

    # Check if already processed (use Cosmos DB or Redis Cache)
    if await is_already_processed(event_id):
        logging.info(f"Duplicate event {event_id} — skipping")
        return  # Do not reprocess

    try:
        result = await do_processing(event.data)
        await mark_as_processed(event_id, result)
    except Exception as e:
        # Do NOT mark as processed — let retry handle it
        raise
```

### Durable Functions for long-running workflows

```python
# Orchestrator (BPM pattern)
@df.orchestrator_generator
def bpm_workflow(context: df.DurableOrchestrationContext):
    # Step 1: Deterministic
    sop_result = yield context.call_activity("run_deterministic_step", input_data)

    # Step 2: Wait for human judgment (can wait days)
    human_decision = yield context.wait_for_external_event("human_judgment_received")

    # Step 3: Continue after human
    final_result = yield context.call_activity("complete_workflow", {
        "sop_result": sop_result,
        "human_decision": human_decision
    })

    return final_result
```

---

## Azure Cosmos DB + Vector Search

See `vector-db-design` skill for MongoDB Atlas. For Azure-native vector search:

### Azure AI Search (formerly Cognitive Search) — Vector search

```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

# Hybrid search: vector similarity + keyword BM25 (best accuracy)
results = search_client.search(
    search_text="invoice payment terms",  # keyword component
    vector_queries=[
        VectorizedQuery(
            vector=embedding,
            k_nearest_neighbors=5,
            fields="contentVector"
        )
    ],
    select=["id", "content", "documentType", "confidence"],
    top=10
)
```

### Cosmos DB change feed → Event processing

```python
# Change feed processor — triggers on every document write
# Useful for: audit logs, downstream sync, cache invalidation

class DocumentChangeProcessor:
    async def process_changes(self, changes: List[dict], token: str):
        for doc in changes:
            event_type = doc.get("eventType")
            if event_type == "extraction.complete":
                await self.trigger_downstream_workflow(doc)
            await self.update_checkpoint(token)
```

---

## Architecture Decision Record (ADR) format

For any significant Azure service selection, produce an ADR and log in `docs/decisions.md`:

```markdown
## ADR: [Service choice] — [Date]

**Context:** [What problem are we solving? What are the constraints?]

**Decision:** Use [Azure service] for [purpose].

**Throughput requirement:** [N events/sec or msg/day]
**Latency requirement:** [real-time / near-real-time / batch]
**Ordering requirement:** [strict / partition-level / none]

**Alternatives considered:**
- [Alternative A]: rejected because [reason]
- [Alternative B]: rejected because [reason]

**Trade-offs accepted:**
- [Trade-off 1]
- [Trade-off 2]

**Cost estimate:** [rough monthly cost at expected scale]

**Implementation notes:** [any non-obvious implementation details]
```

---

## Common anti-patterns to flag

| Anti-pattern | Problem | Correct approach |
|-------------|---------|-----------------|
| Using Event Grid for high-throughput (>10k/sec) | Not designed for it | Event Hub with Kafka surface |
| Storing large payloads in Service Bus messages | 256KB limit; latency | Claim-check pattern: store payload in Blob, send reference |
| Single consumer group for multiple downstream systems | Tightly coupled; one slow consumer blocks others | One consumer group per downstream system |
| No dead-letter monitoring | Silent failures accumulate | Dead-letter queue monitored + alerted in all environments |
| Synchronous calls between microservices | Tight coupling, cascading failures | Event-driven with Event Grid / Service Bus |
| Not setting message TTL | Queue grows unbounded | Always set TTL appropriate to business SLA |
| Timer trigger for "real-time" processing | Not real-time | Event Hub / Event Grid trigger |
