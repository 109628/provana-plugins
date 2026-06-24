# [PROJECT NAME] — Provana AI Project Context

<!-- 
TEMPLATE: Copy this to the root of each Provana AI project repo.
Replace all [PLACEHOLDER] values. Keep under 600 words (~800 tokens).
Sprint-specific notes belong in docs/session-log.md, not here.
-->

## Project

**Name:** [Project name]
**Pod type:** [Pod 1 — Conv.AI / Pod 2 — Doc.AI / Pod 3 — BPM]
**Client:** [Client name]
**Sprint:** [Current sprint number]
**Azure Board project:** [project-name]

## What this system does

[2-3 sentences: what the AI system does, who uses it, what it replaces or automates]

## Skill invocation

| Situation | Run this skill |
|-----------|---------------|
| Starting a new session | `provana-superpowers:provana-bootstrap` |
| New story or feature needed | `provana-superpowers:bmad-discovery` |
| Writing a delivery plan | `provana-superpowers:writing-provana-plans` |
| Implementing plan tasks | `provana-superpowers:subagent-driven-delivery` |
| Writing or running tests | `provana-superpowers:provana-tdd` |
| Scaffolding Conv.AI pipeline | `provana-superpowers:conv-ai-scaffold` |
| Scaffolding Doc.AI pipeline | `provana-superpowers:doc-pipeline-scaffold` |
| Mapping a business process | `provana-superpowers:bpm-discovery` |
| Verifying agent output | `provana-superpowers:agent-qc-harness` |
| Requirements changed mid-sprint | `provana-superpowers:mid-sprint-change` |
| Code ready for review | `provana-superpowers:requesting-provana-review` |
| Production incident | `provana-superpowers:agentic-sre-runbook` |
| LLMOps alert fired | `provana-superpowers:llmops-alert-response` |
| Sprint complete, handing off | `provana-superpowers:finishing-provana-branch` |

## Repository structure

```
[project-name]/
├── src/
│   └── [pod_type]/          # Pod source code (conv_ai / doc_ai / bpm)
├── tests/
│   └── [pod_type]/          # Tests mirror src structure
├── docs/
│   ├── PRD.md               # Product requirements
│   ├── story-NNN.md         # User stories
│   ├── plans/               # Implementation plan files
│   ├── decisions.md         # Architectural decisions log
│   ├── llmops/              # LLMOps runbooks and alert log
│   └── postmortems/         # Blameless postmortems
├── hooks/                   # Provana hook scripts (from plugin)
├── llmops/
│   └── prompt_versions.log  # Prompt version control
├── reports/                 # QC and test reports
└── CLAUDE.md                # This file
```

## Architecture

**External services:** [list: Azure Cognitive Services, OpenAI, LiveKit, etc.]
**Key config:** `src/[pod_type]/config/llm_config.yaml`
**Persona/SOP:** [path to persona YAML or SOP file]
**Observability:** See `docs/observability-config.md`

## Human partner policy

- No code merged without `requesting-provana-review` verdict
- No story closed without `agent-qc-harness` PM/QA PASS
- No architectural decision made without logging to `docs/decisions.md`
- No worktree created without human consent (v5.1.0)
- No production prompt change without staging test + `llmops/prompt_versions.log` entry

## Red flags — stop and check

- "We can skip the tests this once" → No. Run `provana-tdd`.
- "The client wants this today" → Use `mid-sprint-change`, don't accept verbally.
- "Just hardcode it for now" → No. Log in `docs/decisions.md` and do it properly.
- "The review is probably fine" → No. Run `requesting-provana-review`.
- "We'll document it later" → No. Document now or lose the context.

## Key contacts

- PM/QA: [name]
- Agentic SRE lead: [name]
- LLMOps: [name]
- Engineering SRE: [name] (infrastructure escalation only)
