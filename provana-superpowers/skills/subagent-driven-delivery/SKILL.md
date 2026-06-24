---
name: subagent-driven-delivery
description: Use to execute a Provana implementation plan via fresh subagents dispatched per task. Use when a writing-provana-plans plan exists and the human partner has chosen subagent-driven execution, when "start building", "implement the plan", "execute tasks", "run the subagents", or "let's go" is said. Also use for intern-parallel execution where multiple stories run in parallel across separate worktrees. Each subagent gets a fresh context — no drift, no accumulated errors.
---

# Subagent-Driven Delivery

Provana-specific implementation of `superpowers:subagent-driven-development`. Adds BMAD QA integration, Azure Board sync per task, Provana's two-stage review, and intern-parallel execution support.

**Announce at start:** "Running subagent-driven-delivery. I'll dispatch a fresh subagent per task with two-stage review between tasks."

**Prerequisite:** A plan file must exist at `docs/plans/YYYY-MM-DD-[feature].md`. If it doesn't, invoke `provana-superpowers:writing-provana-plans`.

## Execution loop

For each task in the plan:

### 1. Dispatch implementation subagent

```
Execute this task:
- Plan file: docs/plans/[filename].md
- Task: Task N — [Component Name]
- Worktree: [current worktree path]
- Required skill: provana-superpowers:provana-tdd
- Save outputs to: [worktree]/subagent-outputs/task-N/
- Commit after each passing test (do not batch commits)
- Report: files changed, tests added, tests passing, commit hash
```

The subagent runs in isolation — it has no memory of prior tasks. The plan file is its only source of truth. This is intentional.

### 2. Review between tasks (two-stage)

After each subagent completes, do NOT immediately dispatch the next one. Review first.

**Stage 1 — Spec compliance:**
- Did the subagent implement exactly what Task N specified?
- Any files created that weren't in the plan? (YAGNI violation)
- Any AC from the story left unaddressed?
- Is the commit message in the correct Provana format?

**Stage 2 — Code quality:**
- Invoke `provana-superpowers:requesting-provana-review` for the diff
- The reviewer dispatches `Task(general-purpose)` with `code-reviewer.md` template (v5.1.0 — no named agent)
- Critical issues: fix before proceeding. Non-critical: log to `docs/decisions.md` as a deferred item.

### 3. Update Azure Board (if MCP connected)

Close or update the Azure Board subtask for Task N. If all tasks for a story are complete, close the story item.

### 4. Checkpoint decision

After every task (or at natural boundaries for long plans):

> "Task N complete. [summary of what was built]. Ready for Task N+1: [name]? Or do you want to review the code first?"

Do not proceed without acknowledgement if the task touched a high-risk area (payment processing, PII handling, external API integration, schema migration).

## Intern-parallel execution

For Pod 3 (BPM/Explorative) or any sprint where multiple independent stories exist:

- Confirm stories have no file-level dependencies (check plan files)
- Create a separate worktree per story (with consent)
- Dispatch one subagent per worktree simultaneously
- Orchestrator waits for all to complete, then runs two-stage review on each
- Merge order: least risky → most risky

```
Parallel dispatch:
- Worktree A (story-001): Task 1-3 → subagent-A
- Worktree B (story-002): Task 1-4 → subagent-B
- Worktree C (story-003): Task 1-2 → subagent-C
[wait for all three]
→ review each in order
→ merge to sprint branch
```

## Hard constraints (from superpowers v5.1.0)

- Subagents cannot spawn subagents. If a subagent tries to delegate, it fails. The orchestrator (this session) is the only dispatcher.
- Each subagent gets a fresh context window. Do not pass conversation history to subagents — only the plan task and the skill.
- Worktrees are created with consent. Never auto-create.
- The plan file is the single source of truth. Subagents do not improvise beyond the task spec.

## When subagent reports a problem

If a subagent returns an error or incomplete output:

1. Read the subagent's output carefully — what specifically failed?
2. If it's a test failure: invoke `provana-superpowers:provana-tdd` — the RED → GREEN loop handles this
3. If it's an environment issue: check Azure DevOps CI logs, MCP connection status
4. If it's an ambiguous spec: do NOT re-run the subagent with a guess. Go back to `docs/plans/` and clarify the task, then re-dispatch.
5. Log the issue to `docs/decisions.md`: `[DATE] Task N blocked: [reason]. Resolution: [action].`

## Completion

When all plan tasks are done:

> "All [N] tasks complete. Tests passing. Ready for `provana-superpowers:finishing-provana-branch` to verify, review, and prepare handoff."
