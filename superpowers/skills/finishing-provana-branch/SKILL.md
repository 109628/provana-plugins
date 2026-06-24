---
name: finishing-provana-branch
description: Use when a development branch is ready to close at Provana — sprint done, story complete, or handoff to Engineering. Runs the §8 mandatory handoff package checklist, validates provenance-based worktree cleanup (v5.1.0), archives context to the project knowledge base, and transfers everything Engineering SRE needs to own the deployment. Trigger on "we're done", "ready to merge", "hand off to engineering", "finishing the branch", "close the sprint", "delivery complete", "ready for go-live", or any signal that a development cycle is ending.
---

# Finishing a Provana Branch

Structured branch closure and §8 Engineering Handoff for Provana's AI-Native Delivery Model. This is the go-live + handoff skill — it does not deploy, it verifies the deployment readiness package is complete and hands it to Engineering SRE correctly.

**Announce at start:** "Running finishing-provana-branch. Beginning §8 handoff package assembly."

## Why this skill exists

The most common failure mode in Provana's delivery model is informal verbal handoff. Engineering SRE ends up owning a system they cannot operate, maintain, or debug — because the context lived in an AI agent's session memory and was never extracted. This skill closes that loop by making the handoff package an explicit, checkable artefact before any branch is closed.

## Pre-flight: Is this branch actually done?

Before assembling the handoff package, verify:

- [ ] All plan tasks in `docs/plans/[filename].md` are checked off
- [ ] Full test suite passes: `pytest tests/ -v`
- [ ] `agent-qc-harness` has been run and PM/QA verdict is PASS or CONDITIONAL PASS
- [ ] `requesting-provana-review` code review is complete — no Critical or Important issues open
- [ ] All story ACs in `docs/story-NNN.md` have passing tests mapped to them
- [ ] `docs/decisions.md` is current — no unlogged architectural choices
- [ ] No TODO, FIXME, or debug print statements in changed files
- [ ] Azure Board story items are in "Ready for Review" or "Done" state

If any of these fail, stop. Do not assemble the handoff package until the branch is actually done.

## §8 Mandatory Handoff Package

Provana's §8 Engineering Handoff is a formal package — not a PR description. It is designed to allow Engineering SRE to take ownership of the deployed system with zero knowledge transfer calls required.

### 8.1 Codebase + tests

Verify the following are committed and merged:

```
src/[pod]/                      # All pod source code
tests/[pod]/                    # All test files
tests/[pod]/acceptance/         # Pod-specific acceptance test fixtures
tests/qc/test_story_NNN_acs.py  # Generated from ACs by agent-qc-harness
reports/voice-qc-[date].md      # (Conv.AI only)
reports/extraction-qc-[date].md # (Doc.AI only)
reports/bpm-qc-[date].md        # (BPM only)
```

### 8.2 Context file

The project-level `CLAUDE.md` must be production-ready — not a development scratchpad:

- [ ] Skill invocation table is current (remove any skills added only for this sprint)
- [ ] Repository structure section matches the actual deployed structure
- [ ] No sprint-specific notes or WIP comments
- [ ] Token count <800 (run `wc -w CLAUDE.md` — must be under ~600 words)

### 8.3 Decisions log

`docs/decisions.md` must contain a complete audit trail:

- [ ] Every architectural choice made during the sprint is logged
- [ ] Every mid-sprint change is logged (see `mid-sprint-change` skill entries)
- [ ] Every prompt or model version decision is logged (LLMOps entries)
- [ ] Every deferred item is logged with an Azure Board ticket number

### 8.4 Skills package

The skills handed off to Engineering SRE are operational skills — not development skills:

```
skills/agentic-sre-runbook/    # Incident response for this system
```

For each operational skill, verify:
- [ ] SKILL.md references the correct service names and log analytics workspace IDs for this project
- [ ] Pipeline diagnostic scripts exist at the paths referenced in the skill
- [ ] Observability config path referenced in `observability-config.md` exists

### 8.5 Hooks configuration

Engineering SRE inherits the hooks that run in production-adjacent contexts:

```
hooks/settings.json             # Which hooks are active
hooks/sre-runbook-gen.sh        # Auto-invoked on production alerts
hooks/llmops-alert.sh           # Token cost and drift alerts
hooks/secrets-scanner.sh        # Pre-commit secret detection
hooks/injection-detector.sh     # Prompt injection prevention
```

Verify each hook script:
- [ ] References the correct Azure workspace ID for this project
- [ ] Alert destinations (Teams channel, incident channel) are set to production values
- [ ] Not pointing to dev/staging endpoints

### 8.6 LLMOps runbooks

For each model or LLM call in the system, Engineering SRE needs:

```markdown
## LLMOps Runbook — [Agent/Pipeline Name]

### Model configuration
- Model: [model name and version]
- Prompt version: [version tag in llmops/prompt_versions.log]
- Context window budget: [max tokens allocated]
- Temperature: [value]
- Expected token cost per request: [range]

### Alert thresholds
- Cost spike: >[N]x baseline per hour → trigger llmops-alert.sh
- Latency threshold: >[N]ms p95 → escalate to Agentic SRE
- Accuracy floor: <[N]% → escalate to LLMOps + MLOps

### Rollback procedure
1. Check `llmops/prompt_versions.log` for previous stable version
2. Update model config in `src/[pod]/config/llm_config.yaml`
3. Re-run `pytest tests/ -v` against previous version
4. Coordinate with Agentic SRE before deploying rollback

### Escalation path
- P0/P1: Agentic SRE on-call
- P2 (quality degradation): LLMOps + MLOps
- P3 (anomaly): Log to Azure Board, review at next sprint planning
```

One runbook per LLM-backed agent in the system. Save to `docs/llmops/[agent-name]-runbook.md`.

### 8.7 Test library

Engineering SRE needs to be able to run the full test suite without asking the development team:

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Full suite
pytest tests/ -v

# Pod-specific QC tools
python tools/voice_quality_rubric.py --help      # Conv.AI
python tools/extraction_qc.py --help             # Doc.AI
python tools/bpm_compliance_qc.py --help         # BPM
```

Verify:
- [ ] `requirements-test.txt` is current and pinned
- [ ] All fixture data referenced in tests is committed (no paths to local dev machines)
- [ ] Ground-truth datasets for Doc.AI are in `tests/doc_ai/ground_truth/` (committed or documented in README)
- [ ] `README.md` in tests/ explains how to run the harness against production

### 8.8 Observability config

```
docs/observability-config.md
```

Must contain:
- [ ] Azure Log Analytics workspace ID for this project
- [ ] Key telemetry queries for each pod/pipeline
- [ ] Dashboard links (Azure Monitor)
- [ ] Alert rule references (which alerts fire to which channels)
- [ ] What "normal" looks like: baseline token cost, latency p50/p95, accuracy rates

### 8.9 Onboarding prompt

The onboarding prompt is a self-contained text file that Engineering SRE uses to start a Claude session with full project context:

```
docs/onboarding-prompt.md
```

Content structure:
```markdown
# [Project Name] — Engineering SRE Onboarding

You are an SRE agent supporting [project name], a Provana AI product.

## System overview
[2-3 sentences: what this system does, who uses it]

## Architecture
[Pod type, external dependencies, key APIs]

## First steps
1. Load project context: read CLAUDE.md
2. Load decisions log: read docs/decisions.md
3. Sync Azure Board: use board-sync.sh hook
4. Review active alerts: check observability dashboard

## Available skills for this system
- `provana-superpowers:agentic-sre-runbook` — production incident response
- `provana-superpowers:agent-qc-harness` — verify agent output quality
- `provana-superpowers:llmops-alert-response` — handle LLMOps alerts

## Key contacts
- Agentic SRE lead: [name]
- PM/QA: [name]
- LLMOps: [name]
```

## Provenance-based worktree cleanup (v5.1.0)

This is a v5.1.0 requirement. Worktrees must be cleaned up by provenance — only worktrees created in `.worktrees/` are auto-eligible for cleanup. Never run worktree removal commands on paths outside `.worktrees/`.

### Safe cleanup sequence

```bash
# 1. List all worktrees to verify
git worktree list

# 2. Identify worktrees in .worktrees/ that belong to this sprint
ls .worktrees/

# 3. For each completed sprint worktree — ask consent before removing
# "I'm about to remove worktree .worktrees/[name]. This will delete the
# working copy at that path but not the branch. OK?"

# 4. Remove with explicit path (never glob)
git worktree remove .worktrees/[exact-worktree-name]

# 5. Optionally remove the branch after merge
git branch -d [branch-name]
```

**Hard constraints:**
- Never use `git worktree remove --force` without explicit user instruction
- Never remove worktrees outside `.worktrees/` (these were not created by this system)
- If a worktree is in a detached HEAD state, ask before removing — there may be unmerged work

### Detached HEAD check

```bash
# Check for detached HEAD state in any worktree
git worktree list | grep "detached HEAD"
```

If any worktrees are in detached HEAD state, do not remove them. Surface to the human partner:
> "Worktree [name] is in a detached HEAD state — this may contain unmerged work. Please verify before I remove it."

## Memory compiler run

After handoff package is assembled, run the memory compiler to persist the sprint's context to the project knowledge base:

```bash
hooks/mem-compile.sh
```

This extracts:
- New architectural decisions → `docs/decisions.md` (append)
- New skills or patterns discovered → `docs/patterns/`
- Resolved issues → closes any open Azure Board QA items

## Handoff transfer to Engineering SRE

Use the incident communication format from `agentic-sre-runbook` adapted for handoff:

```markdown
## Handoff Complete — [Project Name] — Sprint [N]

**Date:** [date]
**Delivering pod:** [Pod 1/2/3] — [pod name]
**Agentic SRE contact:** [name]

### Package location
All handoff artefacts are in the merged branch at:
`docs/` — decisions log, LLMOps runbooks, observability config, onboarding prompt
`tests/` — full test library with fixture data
`hooks/` — operational hooks (settings.json configured for production)

### What Engineering SRE owns now
- [List the agents, pipelines, or workflows now in production]
- Escalation path for AI-specific incidents: Agentic SRE (not Engineering SRE)
- Engineering SRE owns: infrastructure, networking, database, CI/CD pipeline

### Known open items
| Item | Azure Board | Priority |
|------|-------------|---------|
| [deferred item] | [ticket] | [P1/P2/P3] |

### First thing to do
Run the onboarding prompt at `docs/onboarding-prompt.md` to start a Claude session with full project context.
```

Send to: Engineering SRE lead + PM/QA + Agentic SRE.

## Azure Board final sync

```bash
hooks/board-sync.sh --close-sprint [sprint-id]
```

Marks all completed story items as Done. Deferred items remain open with updated comments.

## What this is NOT

- A deploy skill — Engineering Devops handles the actual deployment pipeline
- Permission to skip `agent-qc-harness` (PM/QA verdict is mandatory before handoff)
- A fast path — every checklist item is mandatory, deadline pressure does not reduce it
