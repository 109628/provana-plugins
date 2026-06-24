# Provana Skills Taxonomy
<!-- references/skills-taxonomy.md -->
<!-- Producer/consumer map for all provana-superpowers skills -->
<!-- Version: provana-superpowers v1.5.0 / superpowers v5.1.0 -->

## Skills by delivery phase

| Phase | Skill | Who uses it | When |
|-------|-------|-------------|------|
| 1. Discovery + Spec | `bmad-discovery` | PM/QA + Analyst | New project or new story |
| 1. Discovery + Spec | `bpm-discovery` | PM/QA + BPM engineer | Pod 3 only: process mapping |
| 2. Architecture | `writing-provana-plans` | Architect + Tech FDE | After PRD is approved |
| 3. Build | `subagent-driven-delivery` | Tech FDE (orchestrator) | Working through plan tasks |
| 3. Build | `provana-tdd` | Tech FDE (subagent) | Every code task, no exceptions |
| 3. Build | `conv-ai-scaffold` | Pod 1 Tech FDE | Pod 1 first sprint only |
| 3. Build | `doc-pipeline-scaffold` | Pod 2 Tech FDE | Pod 2 first sprint only |
| 3. Build | `mid-sprint-change` | PM/QA + Tech FDE | When requirements shift |
| 4. QA + Verify | `agent-qc-harness` | PM/QA | Every story before review |
| 4. QA + Verify | `requesting-provana-review` | Tech FDE | Before every PR merge |
| 5. Merge + Memory | `finishing-provana-branch` | Tech FDE + Agentic SRE | Sprint complete |
| 5. Merge + Memory | `provana-bootstrap` | Everyone | Every new session |
| 6. Go-live + Handoff | `finishing-provana-branch` | Tech FDE + Agentic SRE | Engineering handoff |
| Ongoing ops | `agentic-sre-runbook` | Agentic SRE | Production incidents |
| Ongoing ops | `llmops-alert-response` | LLMOps | Model/cost alerts |
| System design (any project) | `azure-cloud-design` | Architect / Tech FDE | Azure service selection + design |
| System design (any project) | `azure-deployment` | Tech FDE / DevOps | End-to-end Azure provisioning + Bicep |
| System design (any project) | `azure-cicd` | Tech FDE / DevOps | Azure DevOps pipeline YAML + rollback |
| System design (any project) | `vector-db-design` | Architect / Tech FDE | RAG / vector search architecture |
| System design (any project) | `event-driven-design` | Architect / Tech FDE | Event-driven / distributed systems |
| QA (any project) | `qa-automation` | PM/QA / Tech FDE | Playwright + synthetic users + accessibility |
| QA (any project) | `voice-pipeline-eval` | Pod 1 PM/QA | STT WER, intent accuracy, TTS, latency |
| Solo dev productivity | `project-init` | Solo dev / Tech FDE | Bootstrap new project from zero |
| Solo dev productivity | `parallel-build` | Solo dev / Tech FDE | Parallel worktrees + subagent orchestration |
| Context management | `context-manager` | Anyone | Token budget, load/evict, session audit |
| Plugin extension | `tool-forge` | Anyone | When a domain gap is identified |

## Skills by pod

### Pod 1 — Conv.AI

| Skill | Role | Phase |
|-------|------|-------|
| `conv-ai-scaffold` | Pod 1 Tech FDE | Build (first sprint) |
| `provana-tdd` | Pod 1 Tech FDE | Every code task |
| `agent-qc-harness` | Pod 1 PM/QA | QA (voice harness) |
| `agentic-sre-runbook` | Agentic SRE | Ops (STT/LLM/TTS fault isolation) |

### Pod 2 — Doc.AI

| Skill | Role | Phase |
|-------|------|-------|
| `doc-pipeline-scaffold` | Pod 2 Tech FDE | Build (first sprint) |
| `provana-tdd` | Pod 2 Tech FDE | Every code task |
| `agent-qc-harness` | Pod 2 PM/QA | QA (extraction QC) |
| `llmops-alert-response` | LLMOps | Ops (extraction accuracy drift) |

### Pod 3 — BPM

| Skill | Role | Phase |
|-------|------|-------|
| `bpm-discovery` | PM/QA + BPM engineer | Discovery |
| `provana-tdd` | Pod 3 Tech FDE | Every code task |
| `agent-qc-harness` | Pod 3 PM/QA | QA (SOP compliance) |
| `agentic-sre-runbook` | Agentic SRE | Ops (SOP/rule engine/escalation faults) |

## Skills by role

### PM/QA (merged role)

| Skill | When |
|-------|------|
| `bmad-discovery` | Owns Analyst + PM phases |
| `bpm-discovery` | Pod 3: owns process map phase |
| `agent-qc-harness` | Owns all QC verdicts |
| `mid-sprint-change` | Signs off on all scope changes |
| `finishing-provana-branch` | Signs off on handoff package |

### Tech FDE (Technical Field Delivery Engineer)

| Skill | When |
|-------|------|
| `provana-bootstrap` | Start of every session |
| `writing-provana-plans` | After PRD approved |
| `subagent-driven-delivery` | Orchestrating delivery |
| `provana-tdd` | Every code task |
| `conv-ai-scaffold` | Pod 1 kickoff |
| `doc-pipeline-scaffold` | Pod 2 kickoff |
| `requesting-provana-review` | Before every PR |
| `mid-sprint-change` | Implements changes after PM sign-off |
| `finishing-provana-branch` | Branch closure and handoff |

### Agentic SRE / LLMOps / MLOps (Core AI team)

| Skill | When |
|-------|------|
| `agentic-sre-runbook` | Production AI incidents |
| `llmops-alert-response` | Model/cost/drift alerts |
| `finishing-provana-branch` | Receives and verifies §8 handoff |

## Skills that are "rigid" (cannot be skipped or abbreviated)

| Skill | Why rigid |
|-------|----------|
| `provana-tdd` | RED → GREEN is the contract — no green before red, no exceptions |
| `agent-qc-harness` | PM/QA verdict is mandatory — AI output is not self-certifying |
| `requesting-provana-review` | CI gate blocks merge without a completed review |
| `mid-sprint-change` | Verbal scope changes are not accepted — impact analysis is mandatory |
| `finishing-provana-branch` | Handoff package completeness is mandatory — no verbal handoffs |

## Skills that dispatch subagents (v5.1.0 Task(general-purpose) pattern)

| Skill | Subagent task | Template location |
|-------|--------------|-------------------|
| `requesting-provana-review` | Code review | `references/code-reviewer.md` |
| `subagent-driven-delivery` | Per-task implementation | Template embedded in SKILL.md |
| `agent-qc-harness` | AC test generation | Template embedded in SKILL.md |

| `parallel-build` | Per-track feature implementation | Template embedded in SKILL.md |

No named agents used in provana-superpowers v1.5.0. All subagent dispatch uses `Task(general-purpose)` with a bundled prompt template. This is a v5.1.0 requirement.
