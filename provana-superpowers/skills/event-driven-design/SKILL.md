---
name: event-driven-design
description: General-purpose event-driven and distributed systems architecture skill. Use when designing event-driven architectures, CQRS, event sourcing, saga patterns, outbox patterns, async processing pipelines, microservice communication, webhook systems, and stream processing. Works across any cloud or on-premise stack. Trigger on "event-driven", "event sourcing", "CQRS", "saga pattern", "outbox pattern", "async processing", "message queue", "pub/sub", "microservices communication", "distributed transactions", "eventual consistency", "stream processing", "kafka", "event streaming", or any distributed systems design question.
---

# Event-Driven and Distributed Systems Design

General-purpose skill for designing event-driven architectures and distributed systems. Applies to Azure, AWS, GCP, and on-premise. Produces decision records, architecture diagrams, and implementation patterns.

**Announce at start:** "Running event-driven-design. Starting distributed systems analysis."

## Foundational design decisions

Before designing any event-driven system, establish:

1. **Consistency model**: strong, eventual, or causal consistency required?
2. **Failure model**: what happens when a consumer is down for 1 hour? 1 day?
3. **Ordering**: global, partition-level, or per-entity ordering required?
4. **Exactly-once vs at-least-once**: is duplicate processing safe (idempotent)?
5. **Schema evolution**: who owns the schema? How do consumers handle new fields?
6. **Observability**: how will you detect a stuck consumer or a lost event?

---

## Core patterns

### 1. Outbox Pattern (reliable event publishing)

The most common source of lost events in event-driven systems is publishing to a message broker inside a database transaction — if the broker call fails after commit, the event is lost.

**Problem:**
```python
# WRONG — event can be lost if broker call fails after DB commit
async def create_order(order: Order):
    await db.orders.insert_one(order.dict())    # DB committed
    await event_bus.publish("order.created", order)  # CAN FAIL — event lost
```

**Solution — Outbox Pattern:**
```python
# CORRECT — event stored in DB atomically; separate relay publishes it
async def create_order(order: Order):
    async with db.start_session() as session:
        async with session.start_transaction():
            await db.orders.insert_one(order.dict(), session=session)
            await db.outbox.insert_one({          # Atomic with the order
                "eventType": "order.created",
                "payload": order.dict(),
                "status": "pending",
                "createdAt": datetime.utcnow()
            }, session=session)
    # Transaction committed — both order AND outbox entry exist, or neither

# Separate relay process (runs independently)
async def outbox_relay():
    while True:
        events = await db.outbox.find({"status": "pending"}).limit(100).to_list()
        for event in events:
            await event_bus.publish(event["eventType"], event["payload"])
            await db.outbox.update_one(
                {"_id": event["_id"]},
                {"$set": {"status": "published", "publishedAt": datetime.utcnow()}}
            )
```

**Azure implementation**: Azure Cosmos DB change feed as the outbox relay trigger.

### 2. CQRS (Command Query Responsibility Segregation)

Separate the write model (commands) from the read model (queries). Critical for high-read, complex-query workloads.

```
Write side:                         Read side:
  POST /orders (command)              GET /orders/{id} (query)
       │                                    │
       ▼                                    ▼
  Command handler                   Read model store
  (validates, applies)              (MongoDB / Azure AI Search)
       │                                    ▲
       ▼                                    │
  Event store / DB         ──event──▶  Projection builder
  (source of truth)                   (updates read model
                                        asynchronously)
```

```python
# Command handler — writes to event store
class CreateOrderCommandHandler:
    async def handle(self, cmd: CreateOrderCommand) -> str:
        order_id = str(uuid4())
        event = OrderCreatedEvent(
            orderId=order_id,
            customerId=cmd.customerId,
            items=cmd.items,
            timestamp=datetime.utcnow()
        )
        await self.event_store.append(f"order-{order_id}", event)
        return order_id

# Projection — updates read model from events
class OrderProjection:
    async def on_order_created(self, event: OrderCreatedEvent):
        await self.read_db.orders.replace_one(
            {"orderId": event.orderId},
            {
                "orderId": event.orderId,
                "status": "pending",
                "customerId": event.customerId,
                "itemCount": len(event.items),
                "total": sum(i.price for i in event.items),
                "createdAt": event.timestamp
            },
            upsert=True
        )
```

### 3. Saga Pattern (distributed transactions)

For multi-service workflows where you need consistency without a distributed transaction. Two flavours:

**Choreography saga** (event-driven, no central coordinator):
```
OrderService          PaymentService          InventoryService
     │                      │                       │
  order.created ──────────▶ │                       │
                      payment.processed ──────────▶ │
                                             inventory.reserved
                                                     │
                                             order.fulfilled ──▶ (final state)

Compensation (rollback):
  inventory.failed ──────▶ payment.reversed ──▶ order.cancelled
```

**Orchestration saga** (central orchestrator — easier to observe, better for complex flows):
```python
class OrderFulfillmentSaga:
    async def execute(self, order_id: str):
        try:
            # Step 1
            payment_id = await self.payment_service.charge(order_id)
            # Step 2
            reservation_id = await self.inventory_service.reserve(order_id)
            # Step 3
            await self.shipping_service.schedule(order_id)
            await self.mark_complete(order_id)

        except PaymentFailedException:
            await self.mark_failed(order_id, reason="payment")
            # No compensation needed — nothing was charged

        except InventoryFailedException:
            # Compensate step 1
            await self.payment_service.refund(payment_id)
            await self.mark_failed(order_id, reason="inventory")
```

**Use choreography when**: 2–3 services, simple flow, team owns all services.
**Use orchestration when**: 4+ services, complex compensation logic, cross-team boundaries.

### 4. Event Sourcing

Store every state change as an immutable event. Reconstruct current state by replaying events.

```python
# Event store — append-only log per aggregate
class EventStore:
    async def append(self, stream_id: str, event: Event, expected_version: int):
        # Optimistic concurrency control
        result = await self.collection.insert_one({
            "streamId": stream_id,
            "version": expected_version + 1,
            "eventType": event.__class__.__name__,
            "data": event.dict(),
            "timestamp": datetime.utcnow()
        })
        return result

    async def load(self, stream_id: str, from_version: int = 0) -> List[Event]:
        cursor = self.collection.find(
            {"streamId": stream_id, "version": {"$gte": from_version}},
            sort=[("version", 1)]
        )
        return [deserialize_event(e) async for e in cursor]

# Aggregate reconstructed from events
class Order:
    def __init__(self):
        self.state = {}
        self.version = 0

    def apply(self, event: Event):
        if isinstance(event, OrderCreatedEvent):
            self.state = {"status": "pending", "items": event.items}
        elif isinstance(event, OrderPaidEvent):
            self.state["status"] = "paid"
        self.version += 1

    @classmethod
    async def load(cls, order_id: str, store: EventStore) -> "Order":
        order = cls()
        events = await store.load(f"order-{order_id}")
        for event in events:
            order.apply(event)
        return order
```

**When to use event sourcing**: audit trail is a core requirement, temporal queries needed (what was state at time T?), complex domain with many state transitions.

**When NOT to use**: simple CRUD, team unfamiliar with pattern (high learning curve), read-heavy with simple write patterns.

### 5. Competing Consumers Pattern

Multiple consumers process messages from a single queue in parallel. Each message processed exactly once.

```
Queue: document-processing-jobs
    │
    ├──▶ Worker 1 (pulls + locks message → processes → completes)
    ├──▶ Worker 2 (pulls + locks message → processes → completes)
    └──▶ Worker 3 (pulls + locks message → processes → completes)
```

```python
# Azure Service Bus competing consumers
async def worker(receiver: ServiceBusReceiver):
    async with receiver:
        async for msg in receiver:
            try:
                await process_document(json.loads(str(msg)))
                await receiver.complete_message(msg)   # Remove from queue
            except TransientError:
                await receiver.abandon_message(msg)    # Return to queue for retry
            except PermanentError:
                await receiver.dead_letter_message(msg, reason="permanent_failure")
```

### 6. Claim-Check Pattern (large message handling)

Never put large payloads in messages. Store payload externally, pass reference.

```python
# Producer
async def publish_large_document(document: bytes, metadata: dict):
    # Store payload in Blob
    blob_name = f"payloads/{uuid4()}.json"
    blob_client.upload_blob(document)

    # Publish lightweight reference message
    await service_bus.send_message({
        "payloadUri": f"https://[storage].blob.core.windows.net/payloads/{blob_name}",
        "payloadSize": len(document),
        "contentType": "application/json",
        **metadata
    })

# Consumer
async def process_message(msg: dict):
    payload = await blob_client.download_blob(msg["payloadUri"])
    await process(payload)
    await blob_client.delete_blob(msg["payloadUri"])  # Clean up after processing
```

---

## Schema evolution and compatibility

Schema changes in event-driven systems can break consumers silently. Establish a schema strategy before first deployment.

| Compatibility type | What's allowed | Use when |
|------------------|---------------|---------|
| Backward compatible | Add optional fields, don't remove | Consumers lag behind producers |
| Forward compatible | Remove optional fields, don't add required | Producers lag behind consumers |
| Full compatible | Both — add optional only | Multiple versions in production |
| Breaking change | Anything else | Major version bump required; coordinate all consumers |

```python
# Producer — always include schema version
event = {
    "schemaVersion": "1.2",
    "eventType": "extraction.complete",
    "data": { ... }
}

# Consumer — defensive deserialization
def deserialize_event(raw: dict) -> ExtractionCompleteEvent:
    version = raw.get("schemaVersion", "1.0")
    if version.startswith("1."):
        return ExtractionCompleteEventV1.parse(raw["data"])
    elif version.startswith("2."):
        return ExtractionCompleteEventV2.parse(raw["data"])
    else:
        raise UnknownSchemaVersionError(version)
```

---

## Observability for event-driven systems

Distributed tracing is mandatory. Lost events and stuck consumers are invisible without it.

```python
# Propagate trace context through message headers
from opentelemetry import trace
from opentelemetry.propagate import inject, extract

# Producer — inject trace context into message
def publish_with_trace(payload: dict) -> dict:
    headers = {}
    inject(headers)  # Adds traceparent, tracestate
    return {**payload, "_traceContext": headers}

# Consumer — extract and continue trace
def process_with_trace(message: dict):
    ctx = extract(message.get("_traceContext", {}))
    with trace.get_tracer("consumer").start_as_current_span(
        "process_event", context=ctx
    ):
        process(message)
```

### Key metrics to instrument

| Metric | Alert threshold | Tool |
|--------|---------------|------|
| Consumer lag | >1000 messages | Azure Monitor |
| Dead-letter queue depth | >0 | Azure Monitor |
| Processing latency p95 | >SLA | Azure Monitor |
| Event loss rate | >0% | Custom counter |
| Schema validation failures | >0% | Custom counter |

---

## Architecture Decision Record template

```markdown
## ADR: Event-Driven Architecture — [Date]

**Pattern selected:** [Outbox / CQRS / Saga / Event Sourcing / Competing Consumers]

**Consistency model:** [Eventual / Strong / Causal]
**Ordering requirement:** [Global / Partition / Per-entity / None]
**Failure tolerance:** [Consumer down for max Xh before data loss]
**Idempotency:** [Yes / No — if no, document why]

**Message broker:** [Event Hub / Service Bus / Kafka / other]

**Schema versioning strategy:** [Backward / Forward / Full / Major versions]

**Observability:** [Distributed tracing: Yes/No, Consumer lag monitoring: Yes/No]

**Alternatives considered:**
- Synchronous HTTP: rejected because [coupling / cascading failures]
- [Other]: rejected because [reason]

**Trade-offs accepted:**
- Eventual consistency: [impact and mitigation]
- Operational complexity: [monitoring/debugging approach]
```
