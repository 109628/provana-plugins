---
name: requesting-provana-review
description: Use before merging any PR in a Provana project. Dispatches a code review subagent using the Task(general-purpose) pattern (superpowers v5.1.0 — no named agent). Checks security, performance, correctness, Provana conventions, BMAD spec compliance, and Azure DevOps CI gate status. Trigger on "code review", "review this", "ready to merge", "PR review", "check my code", "is this good to merge", or before any git merge operation.
---

# Requesting Provana Review

Provana-specific code review skill. Implements superpowers v5.1.0's pattern: dispatches `Task(general-purpose)` with the full reviewer prompt template. The named `superpowers:code-reviewer` agent was removed in v5.1.0 — this skill contains the persona and checklist directly.

**Announce at start:** "Running requesting-provana-review. Dispatching code reviewer subagent."

## Pre-review checklist (you run this before dispatching)

Before dispatching the reviewer, verify:

- [ ] All plan tasks are checked off in `docs/plans/[filename].md`
- [ ] Full test suite passes locally (`pytest tests/ -v`)
- [ ] No debug code, print statements, or TODO comments left in changed files
- [ ] Diff is scoped to the current story (no unrelated changes)
- [ ] Commit messages follow Provana format: `[type]([pod-scope]): [description]`
- [ ] `docs/decisions.md` updated with any architectural choices made during implementation
- [ ] Azure Board story item is in "Ready for Review" status

If any of these fail, fix before dispatching.

## Dispatcher instruction

```
Task(general-purpose):

You are a Provana code reviewer. Read the full reviewer guide at:
skills/requesting-provana-review/references/code-reviewer.md

Then review the following diff:
[paste diff or provide file paths]

Story context: docs/story-[NNN].md
Plan reference: docs/plans/[filename].md
Pod type: [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]

Save your review to: [worktree]/reviews/review-[date]-[story].md
```

## Reviewer guide reference

See `references/code-reviewer.md` for the full persona, checklist, and severity classifications used by the dispatched reviewer. This is the single source of truth for review criteria (v5.1.0 pattern — no separate agent file).

## Responding to review feedback

**Critical issues (block merge):**
- Security vulnerability (injection, credential exposure, PII mishandling)
- Logic error that violates a story AC
- Test absent for a changed code path
- SLO violation (latency, accuracy threshold not enforced)

Fix immediately. Re-run `provana-superpowers:provana-tdd` for any code change. Re-request review after fixing.

**Important issues (fix in this PR if possible):**
- Code quality: unclear naming, missing error handling, code duplication
- Missing edge case coverage
- Doc drift: code diverges from spec

Fix if the change is contained. If fixing would expand the PR scope significantly, log to `docs/decisions.md` as a deferred item and create an Azure Board task.

**Suggestions (optional):**
- Style, naming, refactoring ideas
- The reviewer will not block on these.

## Azure DevOps CI gate

The `post-test.sh` hook blocks merge unless:
- All tests pass in CI
- No Critical or Important issues remain open
- PM/QA verdict from `agent-qc-harness` is PASS or CONDITIONAL PASS

The reviewer's report does not merge the PR — only a human with merge access can do that.
