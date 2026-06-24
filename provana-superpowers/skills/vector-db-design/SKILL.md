---
name: vector-db-design
description: General-purpose vector database and RAG architecture skill. Covers MongoDB Atlas Vector Search, Azure AI Search, pgvector, Pinecone, and Weaviate. Use when designing retrieval-augmented generation (RAG) pipelines, semantic search, embedding strategies, hybrid search, re-ranking, chunking strategies, and vector index configuration. Trigger on "vector database", "mongodb atlas", "vector search", "RAG", "retrieval augmented", "embeddings", "semantic search", "hybrid search", "pgvector", "pinecone", "weaviate", "chunk documents", "embed documents", "similarity search", or any architecture involving LLM + knowledge retrieval.
---

# Vector Database and RAG Architecture Design

General-purpose skill for designing retrieval-augmented generation pipelines, vector search systems, and embedding infrastructure. Not Provana-specific — applies to any project.

**Announce at start:** "Running vector-db-design. Starting RAG/vector architecture analysis."

## Key decisions before designing

1. **Retrieval goal**: semantic similarity, keyword match, hybrid, or multi-modal?
2. **Data volume**: number of documents, update frequency (static corpus vs live)
3. **Latency budget**: <100ms (live user query) vs seconds (batch / async)
4. **Existing stack**: which database/cloud is already in use?
5. **Query complexity**: simple similarity, filtered similarity, multi-vector, graph traversal
6. **Accuracy requirement**: recall@10 target, acceptable false positive rate

---

## Vector DB Selection

### Decision matrix

| Requirement | MongoDB Atlas | Azure AI Search | pgvector | Pinecone | Weaviate |
|-------------|--------------|----------------|----------|----------|---------|
| Existing MongoDB users | ✅ Native | ❌ Separate | ❌ Separate | ❌ Separate | ❌ Separate |
| Azure-native integration | ⚠️ Via Atlas on Azure | ✅ Native | ⚠️ Via Azure PG Flex | ❌ | ❌ |
| Hybrid search (vector + keyword) | ✅ Full-text + vector | ✅ BM25 + vector | ⚠️ Limited | ❌ Vector only | ✅ BM25 + vector |
| Metadata filtering at query time | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-tenancy / namespace isolation | ✅ (collections) | ✅ (indexes) | ✅ (schemas) | ✅ (namespaces) | ✅ (classes) |
| Managed service | ✅ | ✅ | ✅ (Flexible) | ✅ | ✅ (Cloud) |
| Max vector dimensions | 2048 | 3072 | Unlimited | 20,000 | 65,535 |
| Approximate nearest neighbor algo | HNSW | HNSW | HNSW / IVFFlat | Proprietary | HNSW |
| Change data capture / triggers | ✅ (Change Streams) | ✅ (Indexer) | Via pg triggers | ❌ | ❌ |
| Best for | Full-stack MongoDB apps | Azure-first, enterprise search | PostgreSQL-native apps | Pure vector workloads | Complex schemas + hybrid |

---

## MongoDB Atlas Vector Search

### Index configuration

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "dimensions": 1536,
        "similarity": "cosine",
        "type": "knnVector"
      },
      "documentType": { "type": "filter" },
      "tenantId": { "type": "filter" },
      "createdAt": { "type": "filter" },
      "content": { "type": "string" }
    }
  }
}
```

**Similarity function selection:**
- `cosine` — normalized embeddings (OpenAI, most sentence transformers) — use this by default
- `euclidean` — raw distance, good for sparse vectors
- `dotProduct` — fast, requires pre-normalized vectors

### Hybrid search query (vector + full-text)

```python
# MongoDB Atlas $vectorSearch + $search union (hybrid)
pipeline = [
    {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": 150,   # HNSW candidate pool — higher = better recall, slower
            "limit": 20,
            "filter": {             # Pre-filter by metadata (runs BEFORE vector search)
                "tenantId": tenant_id,
                "documentType": {"$in": ["invoice", "contract"]}
            }
        }
    },
    {
        "$project": {
            "_id": 1,
            "content": 1,
            "documentType": 1,
            "score": {"$meta": "vectorSearchScore"},
            "chunkIndex": 1
        }
    },
    {
        "$limit": 10
    }
]

results = collection.aggregate(pipeline)
```

### Change stream → embedding pipeline (real-time indexing)

```python
# Watch for new documents and auto-embed them
async def watch_and_embed(collection, embedding_fn):
    with collection.watch([{"$match": {"operationType": "insert"}}]) as stream:
        for change in stream:
            doc = change["fullDocument"]
            if "embedding" not in doc:
                text = extract_text_for_embedding(doc)
                embedding = await embedding_fn(text)
                collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"embedding": embedding, "embeddedAt": datetime.utcnow()}}
                )
```

---

## RAG Pipeline Architecture

### Standard RAG pipeline

```
User query
    │
    ▼
Query preprocessing
  - Intent classification (is this a search query or a command?)
  - Query expansion (hypothetical document embedding / HyDE)
  - Entity extraction (for metadata filter construction)
    │
    ▼
Embedding (same model as corpus)
    │
    ▼
Vector retrieval (k-NN / approximate)
  + Optional: metadata pre-filter
  + Optional: hybrid (BM25 + vector)
    │
    ▼
Re-ranking (cross-encoder or LLM re-rank)
  - Reduces from top-20 candidates to top-5
  - Critical for production accuracy
    │
    ▼
Context assembly
  - Dedup chunks from same document
  - Order by relevance or document position
  - Fit within LLM context window budget
    │
    ▼
LLM generation (grounded in retrieved context)
    │
    ▼
Hallucination check (InjectionDetector / GroundednessChecker)
    │
    ▼
Response
```

### Advanced: HyDE (Hypothetical Document Embeddings)

Improves recall for queries that don't look like the indexed content:

```python
# Step 1: Ask LLM to generate a hypothetical answer to the query
hypothetical_doc = await llm.complete(
    f"Write a short document that would answer this question: {user_query}"
)

# Step 2: Embed the hypothetical answer (not the original query)
embedding = embed(hypothetical_doc)

# Step 3: Search with hypothetical embedding → better recall
results = vector_search(embedding, collection)
```

### Chunking strategies

| Strategy | Best for | Chunk size | Overlap |
|---------|---------|------------|---------|
| Fixed-size | Simple text, uniform docs | 512 tokens | 50–100 tokens |
| Sentence-based | Conversational text, Q&A | 1–3 sentences | 1 sentence |
| Recursive character | General purpose (LangChain default) | 500 chars | 50 chars |
| Semantic (embed + cluster) | Long-form documents, articles | Variable | None |
| Document structure (headers) | PDFs with clear sections, contracts | Per section | Heading |
| Sliding window | Dense technical docs, code | 256 tokens | 128 tokens |

**For Doc.AI pipelines**: use document-structure chunking (preserve page/section boundaries). Never split mid-table.

**Chunk metadata to always store:**
```python
{
    "documentId": "[source doc id]",
    "chunkIndex": 3,                    # Position in document
    "pageNumber": 2,                    # For PDFs
    "sectionHeader": "Payment Terms",   # Nearest section header
    "totalChunks": 12,                  # For context assembly ordering
    "embeddingModel": "text-embedding-3-small",
    "embeddingModelVersion": "2024-01",
    "embeddedAt": "2026-05-12T10:00:00Z"
}
```

---

## Embedding Model Selection

| Model | Dimensions | Cost | Best for |
|-------|-----------|------|---------|
| `text-embedding-3-small` (OpenAI) | 1536 | Low | General purpose, most workloads |
| `text-embedding-3-large` (OpenAI) | 3072 | Medium | Higher accuracy, domain-specific |
| `text-embedding-ada-002` (OpenAI, legacy) | 1536 | Low | Legacy systems — migrate to v3 |
| `Azure OpenAI embedding` | 1536/3072 | Same as OpenAI | Azure-hosted (data residency) |
| `all-MiniLM-L6-v2` (HuggingFace) | 384 | Free / self-hosted | Low latency, small scale |
| `BGE-M3` (HuggingFace) | 1024 | Free / self-hosted | Multilingual, high recall |

**Critical rule**: embedding model must be the same at index time and query time. Changing models requires re-embedding the entire corpus.

---

## Re-ranking

Re-ranking is the highest-ROI improvement to RAG accuracy. Always implement for production:

```python
from sentence_transformers import CrossEncoder

# Cross-encoder re-ranker (accurate, slower than bi-encoder)
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(query: str, candidates: List[dict], top_k: int = 5) -> List[dict]:
    pairs = [(query, c["content"]) for c in candidates]
    scores = reranker.predict(pairs)

    ranked = sorted(
        zip(candidates, scores),
        key=lambda x: x[1],
        reverse=True
    )
    return [doc for doc, score in ranked[:top_k]]
```

**LLM-based re-ranking** (higher accuracy, higher cost):
```python
# Ask LLM to score relevance of each candidate
# Use when cross-encoder not sufficient or domain-specific scoring needed
```

---

## Evaluation framework

Production RAG systems must have measurable accuracy. Define before building:

```python
# RAG evaluation metrics
metrics = {
    "recall_at_10": "Are the relevant documents in the top 10 results?",
    "mrr": "Mean Reciprocal Rank — how high is the first relevant result?",
    "context_precision": "Of retrieved chunks, what fraction are relevant?",
    "faithfulness": "Is the LLM response grounded in retrieved context?",
    "answer_relevance": "Does the answer address the query?"
}

# Minimum production thresholds
thresholds = {
    "recall_at_10": 0.85,       # 85% of queries find the relevant doc in top 10
    "context_precision": 0.70,  # 70% of retrieved chunks are relevant
    "faithfulness": 1.0,        # 100% — no hallucinated facts
}
```

Use `RAGAs` library or build a custom evaluation harness. Evaluate before every embedding model or chunking strategy change.

---

## Azure Event Hub + Vector DB integration (streaming indexing)

```
Document upload (Blob Storage)
    │
    ▼ BlobCreated event
Event Grid
    │
    ▼
Azure Function (doc-embedding-trigger)
    │
    ├── Parse document (PyMuPDF / Azure Document Intelligence)
    ├── Chunk into segments
    ├── Embed each chunk (Azure OpenAI / OpenAI)
    └── Upsert to MongoDB Atlas / Azure AI Search
              │
              ▼
    Vector index updated (available for search in ~1–2 seconds)
```

### At scale: Event Hub batching for bulk indexing

```
Document corpus (millions of files)
    │
    ▼
Event Hub (partition key = document type)
    │
    ▼ Consumer group: embedding-workers
Azure Container Apps (auto-scaled)
    │
    ├── Pull batch from Event Hub (up to 100 events)
    ├── Embed batch (parallel requests to OpenAI)
    └── Bulk upsert to vector DB (bulk write, not one by one)
```

---

## Architecture Decision Record template for vector search

```markdown
## ADR: Vector Search Architecture — [Date]

**Data volume:** [N documents, average [N] tokens each]
**Query latency budget:** [Nms p95]
**Update frequency:** [real-time / hourly / daily batch]
**Accuracy target:** [recall@10 = N%]

**Decision:** [MongoDB Atlas Vector Search / Azure AI Search / pgvector / other]

**Chunking strategy:** [fixed-size / structural / semantic]
**Chunk size:** [N tokens / characters]
**Overlap:** [N tokens]

**Embedding model:** [model name and version]
**Dimensions:** [N]
**Similarity function:** [cosine / euclidean / dotProduct]

**Re-ranking:** [Yes / No — if yes, which model]
**Hybrid search:** [Yes / No — if yes, BM25 weight = N]

**Evaluation baseline:** [recall@10 = N% on ground-truth set of N queries]

**Alternatives considered:**
- [Alternative]: rejected because [reason]

**Re-embedding trigger:** [when will corpus need to be re-embedded?]
```
