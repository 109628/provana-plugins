# §8 Engineering Handoff Checklist
<!-- references/handoff-checklist.md -->
<!-- Quick-reference version of the finishing-provana-branch §8 package requirements -->
<!-- Print this and check items off before declaring handoff complete. -->

**Project:** ___________________________
**Sprint:** _____
**Handoff date:** ___________________
**Delivering pod:** _________________
**Receiving:** Engineering SRE

---

## Pre-handoff gate (must all pass)

- [ ] All plan tasks in `docs/plans/*.md` checked off
- [ ] `pytest tests/ -v` — all tests passing
- [ ] `agent-qc-harness` PM/QA verdict: PASS or CONDITIONAL PASS
- [ ] `requesting-provana-review` — no Critical or Important issues open
- [ ] All story ACs have passing tests mapped to them
- [ ] `docs/decisions.md` current (no unlogged architectural choices)
- [ ] No TODO, FIXME, or debug print statements in changed files
- [ ] Azure Board story items: Ready for Review or Done

---

## §8.1 Codebase + tests

- [ ] `src/[pod]/` — all source code committed and merged
- [ ] `tests/[pod]/` — all test files committed
- [ ] `tests/[pod]/acceptance/` — acceptance test fixtures committed
- [ ] `tests/qc/test_story_NNN_acs.py` — AC tests committed
- [ ] QC report committed to `reports/`:
  - [ ] Pod 1: `reports/voice-qc-[date].md`
  - [ ] Pod 2: `reports/extraction-qc-[date].md`
  - [ ] Pod 3: `reports/bpm-qc-[date].md`

## §8.2 Context file (CLAUDE.md)

- [ ] Skill invocation table current
- [ ] Repository structure matches deployed reality
- [ ] No sprint-specific WIP notes
- [ ] Word count: `wc -w CLAUDE.md` → must be under 600 words

## §8.3 Decisions log (docs/decisions.md)

- [ ] All sprint architectural decisions logged
- [ ] All mid-sprint changes logged
- [ ] All prompt/model version decisions logged
- [ ] All deferred items have Azure Board ticket numbers

## §8.4 Skills package

- [ ] `skills/agentic-sre-runbook/` — operational incident skill present
- [ ] SKILL.md references correct service names for this project
- [ ] Pipeline diagnostic scripts exist at referenced paths
- [ ] `docs/observability-config.md` exists and path is correct in SKILL.md

## §8.5 Hooks configuration

- [ ] `hooks/settings.json` — active for production
- [ ] `hooks/sre-runbook-gen.sh` — alert destinations set to production values
- [ ] `hooks/llmops-alert.sh` — AZURE_WORKSPACE set for this project
- [ ] `hooks/secrets-scanner.sh` — verified working
- [ ] `hooks/injection-detector.sh` — verified working
- [ ] No hooks pointing to dev/staging endpoints

## §8.6 LLMOps runbooks

For each LLM-backed agent in the system:

- [ ] `docs/llmops/[agent-name]-runbook.md` exists
- [ ] Model name and version documented
- [ ] Prompt version documented and matches `llmops/prompt_versions.log`
- [ ] Alert thresholds documented and match `hooks/llmops-alert.sh` config
- [ ] Rollback procedure documented and tested
- [ ] Escalation path documented

## §8.7 Test library

- [ ] `requirements-test.txt` current and pinned
- [ ] All fixture data committed (no local paths)
- [ ] Doc.AI ground-truth dataset: committed or location documented in README
- [ ] `tests/README.md` explains how to run the full harness
- [ ] QC tools verified: `python tools/[qc-tool].py --help` works

## §8.8 Observability config (docs/observability-config.md)

- [ ] Azure Log Analytics workspace ID correct
- [ ] Key telemetry queries for each pipeline documented
- [ ] Dashboard links valid (Azure Monitor)
- [ ] Alert rule references correct
- [ ] Baseline metrics documented (normal operating range)

## §8.9 Onboarding prompt (docs/onboarding-prompt.md)

- [ ] Self-contained (SRE gets no other context)
- [ ] SLO values match actual QA plan results
- [ ] Tested: pasted into fresh Claude session and verified functional
- [ ] All file references in the prompt exist and are up to date

---

## Worktree cleanup (v5.1.0)

- [ ] `git worktree list` — reviewed
- [ ] All worktrees in `.worktrees/` from this sprint: consent obtained for removal
- [ ] No worktrees in detached HEAD state (or flagged to human if any)
- [ ] Sprint worktrees removed: `git worktree remove .worktrees/[name]`
- [ ] Memory compiled: `hooks/mem-compile.sh` run

---

## Handoff transfer

- [ ] Handoff message sent to: Engineering SRE lead, PM/QA, Agentic SRE
- [ ] Azure Board: sprint items closed or updated
- [ ] Open deferred items: Azure Board tasks created

---

**Handoff declared complete by:** ___________________________

**Date:** ___________________________

**Engineering SRE acknowledged receipt:** ___________________________
