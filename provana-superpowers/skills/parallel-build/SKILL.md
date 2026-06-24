---
name: parallel-build
description: Use when one developer needs to build multiple features or tracks simultaneously using git worktrees plus subagents. The pattern for parallelising delivery without a team. Trigger on "run multiple features in parallel", "parallel worktrees", "solo parallel build", "split this into tracks".
---

# parallel-build — Solo Dev Parallel Worktree Orchestration

> Invoke when: one developer needs to build multiple features or tracks simultaneously using git worktrees + subagents.
> The definitive pattern for parallelising Provana AI-Native delivery without a team.

---

## When to invoke

- "Run multiple features in parallel"
- "I want to work on [A] and [B] at the same time"
- "Set up worktrees for the sprint"
- "Orchestrate parallel implementation"
- `provana-superpowers:parallel-build`

---

## Core principle

A solo developer with Claude can behave like a 3–4 person team by running concurrent worktrees, each with its own subagent. The developer acts as **orchestrator** — not implementer. They assign work, review results, and merge.

```
Developer (orchestrator)
  ├── Worktree 1: feat/[pod]-story-A  → Subagent A (implement + test)
  ├── Worktree 2: feat/[pod]-story-B  → Subagent B (implement + test)
  ├── Worktree 3: infra/[component]   → Subagent C (Bicep / az CLI)
  └── Worktree 4: fix/[issue]         → Subagent D (fix + regression)
```

All worktrees share the same git object store (efficient). Each has an independent working tree — no interference.

---

## Step 1 — Sprint planning (before creating worktrees)

Write the parallel plan to `docs/plans/sprint-[N]-parallel.md`:

```markdown
# Sprint [N] Parallel Build Plan

## Tracks

### Track A — [Story title]
- Branch: feat/[pod]-[story-id]-[short-name]
- Scope: [2-3 sentences]
- Entry criteria: [what must be true before starting]
- Exit criteria: [what tests prove it done]
- Estimated sessions: [N]
- Dependencies on other tracks: [none | track-B must complete X first]

### Track B — [Story title]
...

### Track C — Infrastructure
- Branch: infra/[component]
- Scope: [what Azure resources or config]
- No code dependencies on Track A/B

## Merge order
1. Track C (infra — no logic deps)
2. Track A and B can merge in any order IF they touch different modules
3. Cross-track integration test after both A + B merge to develop
```

**Rule:** Tracks that touch the same file create merge conflicts. Identify overlapping files before creating worktrees. Assign each file to exactly one track.

---

## Step 2 — Create worktrees (with consent gate)

**NEVER create worktrees without showing this summary and asking "Proceed?"**

```
Proposed worktrees:
  .worktrees/feat-story-a   →  branch: feat/pod-story-a   (new)
  .worktrees/feat-story-b   →  branch: feat/pod-story-b   (new)
  .worktrees/infra-postgres  →  branch: infra/postgres      (new)

All will be created under .worktrees/ (gitignored).
Proceed? [y/n]
```

After confirmation:

```bash
# Must be run from repo root (main or develop branch)
BASE_BRANCH="develop"

# Track A
git worktree add .worktrees/feat-story-a -b feat/pod-story-a "$BASE_BRANCH"

# Track B  
git worktree add .worktrees/feat-story-b -b feat/pod-story-b "$BASE_BRANCH"

# Track C (infra)
git worktree add .worktrees/infra-postgres -b infra/postgres "$BASE_BRANCH"

# Verify
git worktree list
```

---

## Step 3 — Dispatch subagents

Use `Task(general-purpose)` for each track. **Critical: each subagent must be given a self-contained prompt** that includes everything it needs — no assumed shared context.

### Subagent prompt template

```
WORKTREE: .worktrees/[track-name]
BRANCH: [branch-name]

## Your task
[Full story text — what to build, acceptance criteria, edge cases]

## Constraints
- Work ONLY in path: .worktrees/[track-name]/
- Follow provana-tdd: write RED test first, then implement
- Do NOT touch these files (owned by other tracks): [list]
- Run pytest from the worktree: cd .worktrees/[track-name] && pytest tests/ -q
- Exit criteria: all tests green, no TODOs, no print() statements

## Context files to read first
- .worktrees/[track-name]/CLAUDE.md
- .worktrees/[track-name]/docs/arch.md
- .worktrees/[track-name]/docs/story-[id].md

## Output
When done, write a one-paragraph summary to:
.worktrees/[track-name]/reports/track-[name]-complete.md

Format:
  TRACK: [name]
  STATUS: COMPLETE | BLOCKED
  FILES CHANGED: [list]
  TESTS: [N passed / N total]
  NOTES: [anything the orchestrator needs to know]
```

### Dispatching all tracks simultaneously

```python
# Claude dispatches these as concurrent Task() calls
# (send all three in a single message to run them in parallel)

Task(general-purpose, prompt="""
WORKTREE: .worktrees/feat-story-a
[full prompt for story A]
""")

Task(general-purpose, prompt="""
WORKTREE: .worktrees/feat-story-b
[full prompt for story B]
""")

Task(general-purpose, prompt="""
WORKTREE: .worktrees/infra-postgres
[full prompt for infra track]
""")
```

---

## Step 4 — Monitor progress

While subagents run, check status without interrupting:

```bash
# Check test results per track
for wt in .worktrees/*/; do
  echo "=== $wt ==="
  if [ -f "$wt/reports/track-*-complete.md" ]; then
    cat "$wt/reports/track-*-complete.md"
  else
    echo "  [in progress]"
  fi
done

# Check for any test failures being written
tail -n 5 .worktrees/feat-story-a/.pytest_cache/v/cache/lastfailed 2>/dev/null || true
```

---

## Step 5 — Review and merge tracks

When a subagent completes, review before merging:

```bash
# Review what changed in a track
cd .worktrees/feat-story-a
git diff develop...HEAD --stat
git log develop..HEAD --oneline

# Run tests one more time from the worktree
pytest tests/ --tb=short -q

# If green: merge to develop
cd [repo-root]
git checkout develop
git merge feat/pod-story-a --no-ff -m "feat(pod): [story title] — [brief summary]"
```

**Merge order rules:**

1. Merge infrastructure tracks first (no code deps).
2. Merge feature tracks one at a time. Run `pytest` on develop after each merge.
3. If two feature tracks both touched `src/shared/`, expect conflicts — resolve manually (see Step 6).
4. After all tracks merged: run full test suite on develop.

---

## Step 6 — Conflict resolution

```bash
# When git merge reports conflict:
git status  # shows conflicted files

# For each conflicted file:
# 1. Open file — look for <<<<<<< HEAD markers
# 2. Decide: keep ours, keep theirs, or blend
# 3. Edit to final state, remove markers
git add [resolved-file]
git merge --continue

# After resolution: run full test suite
pytest tests/ -q
```

**Conflict prevention (do this in Step 1):**

- Track A owns: `src/[pod]/handlers/`, `tests/unit/handlers/`
- Track B owns: `src/[pod]/services/`, `tests/unit/services/`
- Track C owns: `bicep/`, `hooks/`, `docs/arch.md`
- Shared files (`src/[pod]/models.py`, `src/[pod]/config.py`) → assign to ONE track; other tracks read-only

---

## Step 7 — Cleanup worktrees

**Only clean up worktrees under `.worktrees/` — never touch paths outside it.**

```bash
# After a track is merged and verified:
WORKTREE_PATH=".worktrees/feat-story-a"
BRANCH="feat/pod-story-a"

# Confirm the worktree HEAD is merged into develop
git log develop --oneline | grep "$(git -C $WORKTREE_PATH rev-parse HEAD)" && \
  echo "SAFE TO REMOVE — commit is in develop"

# Remove worktree
git worktree remove "$WORKTREE_PATH"

# Delete branch (only after merge verified)
git branch -d "$BRANCH"
```

**Safety checks before removal:**

```bash
# Check for unmerged commits
UNMERGED=$(git log develop.."$BRANCH" --oneline | wc -l)
[ "$UNMERGED" -gt 0 ] && echo "WARNING: $UNMERGED unmerged commits — do not remove"

# Check for detached HEAD (subagent may have left one)
git -C "$WORKTREE_PATH" status | grep "HEAD detached" && \
  echo "WARNING: detached HEAD in $WORKTREE_PATH — check before removing"
```

---

## Step 8 — Cross-track integration test

After all tracks are merged to develop:

```bash
cd [repo-root]
git checkout develop

# Run full suite (unit + integration)
pytest tests/ -v --tb=short

# If the project has inter-service integration tests:
pytest tests/integration/ -v --tb=long

# Run Provana post-test gate
bash hooks/post-test.sh
```

Only push to develop after this gate is green.

---

## Parallel patterns reference

### Pattern: Feature + Infra in parallel

Best for: new feature that requires new Azure resources.

```
Track A: feat/pod-new-feature  →  implements feature against local mock
Track B: infra/new-resource     →  provisions Azure resource, outputs connection string
Merge:   B first (infra), then A
Integration: replace mock with real connection string from .env.azure.dev
```

### Pattern: Multi-story sprint

Best for: 2–3 independent user stories from the same sprint.

```
Track A: feat/pod-story-101  →  story 101
Track B: feat/pod-story-102  →  story 102 (no shared files with 101)
Track C: fix/pod-bug-87      →  hotfix (small, merge first)
Merge order: C → A → B
```

### Pattern: Refactor + Feature

Best for: a refactor that will unblock a new feature.

```
Track A: refactor/pod-clean-models  →  only moves/renames, no logic change
Track B: feat/pod-new-endpoint      →  waits for Track A to merge
Sequential not parallel — Track B cannot start until A is merged.
Exception: if the interface is stable (agreed in arch.md), B can mock the new interface.
```

---

## Token efficiency notes

- Each subagent dispatched via `Task()` gets a fresh context window — they don't inherit the orchestrator's context bloat.
- Keep subagent prompts self-contained but concise. Story context + file paths + exit criteria should fit in ~500 tokens.
- The orchestrator's context grows with each review cycle. After 3–4 merge cycles, run `provana-superpowers:context-manager` to audit and trim.

---

## Red flags

- Worktrees outside `.worktrees/` → pre-commit.sh and skill-router will not recognise them.
- Assigning the same file to two tracks → guaranteed merge conflict, guaranteed lost work.
- Subagent running `git checkout` inside a worktree → corrupts the worktree state. Subagents should ONLY commit, never switch branches.
- Merging without running tests on develop post-merge → a track that passes in isolation may break with the other track's changes.
- Cleaning up a worktree whose branch has unmerged commits → data loss. Always verify merge before removal.
- More than 4 active worktrees → context fragmentation outweighs parallelism gains for a solo dev. Cap at 4.
