---
name: mid-sprint-change
description: Use when requirements change mid-sprint at Provana. Runs impact analysis, creates a new worktree (with consent), updates the plan doc and affected stories, re-runs provana-tdd for changed tasks, and logs all changes to decisions.md. Trigger on "requirement change", "the client wants", "scope change", "we need to change", "pivot", "new requirement", "roadblock", "update the spec", "this needs to change", "we missed something", or any mid-sprint requirement shift. Mandatory gate — no silent acceptance of scope changes.
---

# Mid-Sprint Change

Handles requirement changes mid-sprint without clobbering in-flight work. Every scope change goes through this skill — there is no silent acceptance of new requirements.

**Announce at start:** "Running mid-sprint-change to handle the requirement shift safely."

## Why this skill exists

Mid-sprint changes are the most common source of broken deliverables at Provana. The failure mode: a developer accepts a verbal change, modifies code in-flight, forgets to update the spec, and the QA step verifies against the wrong AC. This skill closes that loop.

## Step 1: Understand the change

Run a mini version of `bmad-discovery` for the change:

- What exactly is changing? (be precise — "the client wants X instead of Y")
- What was the original requirement? (read `docs/PRD.md` and relevant `docs/story-NNN.md`)
- Why is it changing? (context helps assess risk)
- Is this a scope expansion, a scope reduction, or a correction?
- What is the deadline pressure? (does not bypass the skill — adjusts the thoroughness)

Ask the human partner to confirm the change in their own words before continuing.

## Step 2: Impact analysis

Identify every file and story that the change affects:

```markdown
## Impact Analysis — [Change description] — [Date]

### Spec changes required
- [ ] docs/PRD.md — [which section changes]
- [ ] docs/story-NNN.md — [which ACs change or are added]
- [ ] docs/story-MMM.md — [if another story is affected]

### Plan changes required
- [ ] docs/plans/[filename].md — Tasks [N, N+1, N+3] affected
  - Task N: [original] → [new]
  - Task N+1: [delete / modify / add]

### Code changes required
- [ ] src/[pod]/[module].py — [what changes]
- [ ] tests/[pod]/test_[feature].py — [tests that need updating]

### Risk level
[ ] Low — isolated change, no cross-pod impact
[ ] Medium — affects multiple stories or shared modules
[ ] High — touches existing production-facing code, schema, or external API

### Stories affected
- story-NNN: [impact description]
- story-MMM: [impact description — if applicable]
```

Present this to the human partner. For Medium or High risk: require explicit sign-off before proceeding.

## Step 3: Create new worktree (with consent)

For any non-trivial change, work in a new worktree:

> "I need to create a new worktree for this change to keep existing work safe. OK to proceed?"

Wait for yes. Then:

```bash
# Create worktree in .worktrees/ (provenance-safe, v5.1.0)
git worktree add .worktrees/mid-sprint-[feature-name]-[date] -b mid-sprint/[feature-name]-[date]
```

Existing work is never touched. The change branches from the current sprint branch.

## Step 4: Update spec documents

Update only what changed. Append-only to `docs/decisions.md`.

**PRD.md update:**
- Mark the changed section clearly with `> **CHANGED [date]:** [reason]`
- Do not rewrite history — add a change note inline

**Story file update:**
```markdown
## Change log
| Date | Change | Reason | Approved by |
|------|--------|--------|-------------|
| [date] | [what changed] | [why] | [PM/QA name] |
```

**decisions.md append:**
```
[DATE] Mid-sprint change: [story reference]. [What changed]. [Why]. Impact: [N files, M tasks]. Approved by: [name]. Worktree: mid-sprint/[name].
```

## Step 5: Update the plan

In the affected plan file (`docs/plans/`):

- Mark changed tasks with `> **CHANGED [date]:**`
- Strike through deleted tasks (don't delete them — audit trail matters)
- Add new tasks at the end with clear `> **NEW [date]:**` markers
- Update file paths if changed
- Verify all new tasks follow TDD structure (RED → GREEN → COMMIT)

## Step 6: Execute changes

Invoke `provana-superpowers:subagent-driven-delivery` on the updated tasks only.

For each changed task, the subagent starts fresh — no carry-over from the previous implementation.

After implementation: run the full test suite (not just changed tests) to catch regressions:

```bash
pytest tests/ -v --tb=short
```

## Step 7: PM agent re-shards affected stories

For Medium/High risk changes, the PM agent reviews all stories that were affected and confirms:
- ACs are still internally consistent
- No story has contradicting requirements after the change
- Azure Board items reflect the updated scope

## Step 8: Close the loop

Update Azure Board via MCP:
- Close/update original items if superseded
- Create new items for added scope
- Link change to the original story with a comment

Log in `docs/decisions.md`:
```
[DATE] Mid-sprint change resolved. [Story NNN] updated. Tasks [list] re-implemented. Tests passing. Azure Board [item] updated.
```

## What this is NOT

- Permission to skip `bmad-discovery` for large changes (anything that changes the PRD goal requires a full discovery re-run)
- An excuse to update code without updating the spec first
- A fast path that skips TDD (every changed task still requires RED → GREEN)
