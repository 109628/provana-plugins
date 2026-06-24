# Architecture Overview — [Project Name]
<!-- Template: docs/arch.md -->
<!-- Produced by: writing-provana-plans skill (Architect role) -->
<!-- Updated when: significant structural decisions are made -->

**Pod type:** [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]
**Version:** 1.0
**Date:** [YYYY-MM-DD]
**Author:** [Architect / Core AI team]

---

## System overview

[3-5 sentences: what this system does architecturally, what it connects to, and what it produces.]

## Architecture diagram

```
[External input]
       │
       ▼
┌─────────────────────────────────────────────┐
│  [Project Name] — [Pod Type] Pipeline        │
│                                              │
│  ┌─────────┐   ┌─────────┐   ┌──────────┐  │
│  │ Stage 1  │──▶│ Stage 2  │──▶│ Stage 3  │  │
│  │ [name]   │   │ [name]   │   │ [name]   │  │
│  └─────────┘   └─────────┘   └──────────┘  │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │  LLM: [model] | Prompt v[N]           │  │
│  │  Context budget: [N] tokens           │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
       │
       ▼
[Output destination]
```

*Replace with actual architecture diagram appropriate to the pod type.*

## Pod 1 — Conv.AI architecture template

```
Phone/Web call
     │
     ▼
┌─────────────────────────────────────────────┐
│  Conv.AI Pipeline                            │
│                                              │
│  LiveKit ──▶ STT (Azure Cognitive)          │
│               │                             │
│               ▼                             │
│          Intent Router (LLM)               │
│          /           \                      │
│   Deterministic    Escalation               │
│   Response (LLM)   (Human transfer)        │
│          │                                  │
│          ▼                                  │
│        TTS ──▶ Audio response               │
│                                              │
│  Persona: src/conv_ai/personas/[name].yaml  │
└─────────────────────────────────────────────┘
```

## Pod 2 — Doc.AI architecture template

```
Document (PDF/DOCX/Excel)
     │
     ▼
┌─────────────────────────────────────────────┐
│  Doc.AI Pipeline                             │
│                                              │
│  Ingest (file read + type classification)   │
│     │                                        │
│     ▼                                        │
│  Parse (layout analysis, PyMuPDF/other)     │
│     │                                        │
│     ▼                                        │
│  Extract (schema-driven LLM extraction)     │
│     │                   │                   │
│   High confidence   Low confidence          │
│   auto-pass         flag to human           │
│     │                                        │
│     ▼                                        │
│  Store (structured output, schema v[N])     │
└─────────────────────────────────────────────┘
```

## Pod 3 — BPM architecture template

```
Business event / trigger
     │
     ▼
┌─────────────────────────────────────────────┐
│  BPM Agent                                   │
│                                              │
│  SOP Lookup (version-controlled YAML)       │
│     │                                        │
│     ▼                                        │
│  Step classifier                            │
│  /                    \                     │
│ Deterministic          Judgment             │
│ Rule engine            Escalation to human  │
│ (100% SOP compliance)  (explicit flagging)  │
│     │                                        │
│     ▼                                        │
│  Stakeholder output (non-technical)         │
└─────────────────────────────────────────────┘
```

## Key components

| Component | Location | Purpose | Owner |
|-----------|---------|---------|-------|
| [Component] | `src/[pod]/[module].py` | [purpose] | [pod team] |
| LLM config | `src/[pod]/config/llm_config.yaml` | Model + prompt config | Core AI |
| Observability | `docs/observability-config.md` | Azure Monitor setup | Agentic SRE |

## External dependencies

| Service | Purpose | Auth method | SLA |
|---------|---------|------------|-----|
| [Azure OpenAI / OpenAI] | LLM inference | API key (env var) | 99.9% |
| [Azure Cognitive Services] | STT/TTS (Conv.AI) | API key | 99.9% |
| [LiveKit] | Voice transport (Conv.AI) | API key | 99.9% |
| [Azure Blob Storage] | Document storage (Doc.AI) | Managed identity | 99.9% |

## Data flow and PII

| Data type | Where it flows | Retention | PII? |
|-----------|---------------|-----------|------|
| [Customer call audio] | LiveKit → STT → discarded | Per call | Yes |
| [Extracted fields] | LLM → structured store | [period] | [Yes/No] |
| [Process decisions] | BPM agent → audit log | [period] | [Yes/No] |

## Observability

See `docs/observability-config.md` for:
- Azure Log Analytics workspace ID
- Key telemetry queries
- Alert thresholds
- Baseline metrics (normal operating range)

## Known constraints and trade-offs

| Constraint | Impact | Decision log reference |
|-----------|--------|----------------------|
| [constraint] | [impact] | `docs/decisions.md` [date] |
