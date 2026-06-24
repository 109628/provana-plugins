# Pod Skills Map
<!-- references/pod-skills-map.md -->
<!-- Quick reference: which skills to use for each pod type at each phase -->

## How to use this map

Look up your pod type and current phase. The listed skills are the mandatory ones for that combination.
Skills marked 🔒 are rigid — they cannot be skipped or abbreviated.

---

## Pod 1 — Conv.AI (LiveKit + STT + LLM + TTS)

| Phase | Skills | Notes |
|-------|--------|-------|
| Discovery | `bmad-discovery` 🔒 | Conv.AI context: voice persona, intent taxonomy, escalation paths |
| Architecture | `writing-provana-plans` | Conv.AI plan: voice turn test structure, latency SLO |
| First build | `conv-ai-scaffold` | Run once at project start. Generates pipeline scaffold + voice harness |
| All builds | `subagent-driven-delivery` + `provana-tdd` 🔒 | Orchestrator + per-task TDD |
| QA | `agent-qc-harness` 🔒 | Voice harness: intent accuracy >90%, latency <500ms, MOS >3.5 |
| Review | `requesting-provana-review` 🔒 | Pod 1 checklist: persona YAML, voice harness, latency assertion |
| Mid-sprint change | `mid-sprint-change` 🔒 | E.g. new intent, persona change, escalation path update |
| Branch close | `finishing-provana-branch` 🔒 | §8.4: operational SRE skill references STT/LLM/TTS fault isolation |
| Ops | `agentic-sre-runbook` | Fault isolation: `pipeline_diagnostics.py --stage [stt\|llm\|tts]` |
| Ops | `llmops-alert-response` | Intent accuracy floor: <85% triggers P1 |

**Key SLOs:**
- Turn response latency: <500ms p95
- Intent accuracy: >90%
- Escalation accuracy: 100%
- TTS naturalness (MOS): >3.5

**Key files:**
- `src/conv_ai/pipelines/[name]_pipeline.py`
- `src/conv_ai/personas/[name].yaml`
- `src/conv_ai/config/llm_config.yaml`
- `tests/conv_ai/acceptance/`
- `tools/voice_quality_rubric.py`
- `tools/pipeline_diagnostics.py`

---

## Pod 2 — Doc.AI (Document Extraction, Engineering-Facing)

| Phase | Skills | Notes |
|-------|--------|-------|
| Discovery | `bmad-discovery` 🔒 | Doc.AI context: document types, extraction fields, confidence thresholds |
| Architecture | `writing-provana-plans` | Doc.AI plan: schema definition, ground-truth dataset requirements |
| First build | `doc-pipeline-scaffold` | Run once. Generates ingest→parse→extract→store scaffold + ExtractionQC |
| All builds | `subagent-driven-delivery` + `provana-tdd` 🔒 | Orchestrator + per-task TDD |
| QA | `agent-qc-harness` 🔒 | Extraction QC: per-field accuracy >85%, missed field rate <5% |
| Review | `requesting-provana-review` 🔒 | Pod 2 checklist: schema version, missing field handling, ground-truth dataset |
| Mid-sprint change | `mid-sprint-change` 🔒 | E.g. new document type, schema field added, confidence threshold changed |
| Branch close | `finishing-provana-branch` 🔒 | §8: ground-truth dataset committed to `tests/doc_ai/ground_truth/` |
| Ops | `agentic-sre-runbook` | Fault isolation: `extraction_diagnostics.py --pipeline [name]` |
| Ops | `llmops-alert-response` | Extraction accuracy floor: <80% triggers P1 |

**Key SLOs:**
- Extraction accuracy: >85% per field
- Missed field rate: <5%
- Below-confidence fields: 100% flagged (never silently passed)

**Key files:**
- `src/doc_ai/pipelines/[name]_pipeline.py`
- `src/doc_ai/config/schema_v[N].yaml`
- `src/doc_ai/config/llm_config.yaml`
- `tests/doc_ai/ground_truth/`
- `tools/extraction_qc.py`
- `tools/extraction_diagnostics.py`

---

## Pod 3 — BPM (Business Process Management, Explorative)

| Phase | Skills | Notes |
|-------|--------|-------|
| Discovery | `bpm-discovery` 🔒 | Pod 3-specific: process map, feasibility scoring, SOP gap analysis |
| Discovery | `bmad-discovery` 🔒 | Also run for formal PRD and story writing |
| Architecture | `writing-provana-plans` | BPM plan: intern-parallel execution, SOP version references |
| Build | `subagent-driven-delivery` + `provana-tdd` 🔒 | Pod 3 uses intern-parallel for independent BPM tasks |
| QA | `agent-qc-harness` 🔒 | SOP compliance QC: 100% deterministic, judgment escalations verified |
| Review | `requesting-provana-review` 🔒 | Pod 3 checklist: SOP version, judgment flagging, stakeholder output language |
| Mid-sprint change | `mid-sprint-change` 🔒 | E.g. SOP version update, new escalation path, process scope change |
| Branch close | `finishing-provana-branch` 🔒 | §8: SOP files committed, stakeholder output reviewed |
| Ops | `agentic-sre-runbook` | Fault isolation: `bpm_trace.py --case-id [id]` |
| Ops | `llmops-alert-response` | SOP compliance floor: <100% deterministic triggers P0 |

**Key SLOs:**
- Deterministic step compliance: 100%
- Judgment steps: 100% flagged to human (zero auto-resolved)
- Stakeholder output: non-technical language verified

**Key files:**
- `src/bpm/agents/sop_[name]_agent.py`
- `docs/[name]-sop.yaml`
- `tests/bpm/acceptance/`
- `tools/bpm_compliance_qc.py`
- `tools/bpm_trace.py`

---

## Cross-pod skills (all pods use these)

| Skill | When | Rigid? |
|-------|------|--------|
| `provana-bootstrap` | Start of every session | No |
| `bmad-discovery` | New story needed | 🔒 Yes |
| `writing-provana-plans` | Plan needed | No |
| `subagent-driven-delivery` | Implementing plan | No |
| `provana-tdd` | Every code task | 🔒 Yes |
| `agent-qc-harness` | Before review | 🔒 Yes |
| `requesting-provana-review` | Before merge | 🔒 Yes |
| `mid-sprint-change` | Scope shifts | 🔒 Yes |
| `finishing-provana-branch` | Sprint close | 🔒 Yes |
| `agentic-sre-runbook` | Production incident | No (but fast) |
| `llmops-alert-response` | LLMOps alert | No (but fast) |
