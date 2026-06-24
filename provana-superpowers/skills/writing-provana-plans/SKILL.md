---
name: writing-provana-plans
description: Use after bmad-discovery is complete and PRD.md is approved, before any implementation begins. Breaks an approved Provana spec into bite-sized TDD implementation tasks with exact file paths, complete code, Azure Board story links, and subagent dispatch instructions. Trigger on "write the plan", "ready to implement", "break this into tasks", "implementation plan", "plan this out", or after human sign-off on PRD.md. Must be run in a git worktree (created with consent).
---

# Writing Provana Plans

Provana-specific implementation of `superpowers:writing-plans`. Adds Azure Boards integration, BMAD subagent references, pod-specific file conventions, and Provana's two-repo architecture.

**Announce at start:** "Running writing-provana-plans to create the implementation plan."

**Prerequisite:** `bmad-discovery` must have run and PRD.md must be approved. If you don't have a PRD.md, stop and invoke `provana-superpowers:bmad-discovery`.

**Worktree:** Before writing the plan, confirm you're in a git worktree. If not, invoke `superpowers:using-git-worktrees` — and ask for consent before creating one (v5.1.0 requirement).

## Plan header (mandatory)

Every Provana plan MUST start with:

```markdown
# [Feature Name] — Provana Implementation Plan
**Story:** docs/story-NNN.md | **PRD:** docs/PRD.md | **Azure Board:** [item-id]
**Pod:** [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]
**FDE type:** [Technical / Technical+ / Hybrid]
**Date:** YYYY-MM-DD

> **For Claude:** REQUIRED SUB-SKILL: Use `provana-superpowers:subagent-driven-delivery` to implement this plan task-by-task.

**Goal:** [One sentence from PRD success criteria]
**Architecture:** [2-3 sentences — reference docs/arch.md for full detail]
**Tech stack:** [Key technologies, MCP integrations]

---
```

## Task structure

Each task must be 2-5 minutes of agent work. No larger. Break ruthlessly.

```markdown
### Task N: [Component Name]
**Azure Board subtask:** [item-id or "create on start"]
**Skill:** [provana-superpowers:conv-ai-scaffold | doc-pipeline-scaffold | bpm-discovery | provana-tdd]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:L123-L145`
- Test: `tests/exact/path/to/test_feature.py`

**Step 1: Write the failing test**
```python
def test_[specific_behavior]():
    # Arrange
    [setup]
    # Act
    result = [function_under_test](input)
    # Assert
    assert result == expected_value
```

**Step 2: Run test → verify RED**
```bash
pytest tests/path/test_feature.py::test_specific_behavior -v
# Expected: FAILED — [function_under_test] not defined
```

**Step 3: Write minimal implementation**
```python
def [function_under_test](input):
    return expected_value  # minimal — no speculation
```

**Step 4: Run test → verify GREEN**
```bash
pytest tests/path/test_feature.py::test_specific_behavior -v
# Expected: PASSED
```

**Step 5: Commit**
```bash
git add tests/path/test_feature.py src/path/file.py
git commit -m "feat([scope]): [what it does, not how]"
```
```

## Provana-specific conventions

**File paths by pod:**

Pod 1 (Conv.AI):
- Agent modules: `src/conv_ai/agents/[name].py`
- Flow specs: `src/conv_ai/flows/[name]_flow.py`
- Tests: `tests/conv_ai/test_[name].py`
- Voice harness: `tests/harness/voice_simulator.py`

Pod 2 (Doc.AI):
- Pipelines: `src/doc_ai/pipelines/[name]_pipeline.py`
- Extractors: `src/doc_ai/extractors/[name]_extractor.py`
- Schema: `src/doc_ai/schemas/[name]_schema.py`
- Tests: `tests/doc_ai/test_[name].py`

Pod 3 (BPM):
- Process maps: `src/bpm/processes/[name]_process.py`
- SOP agents: `src/bpm/agents/sop_[name]_agent.py`
- Tests: `tests/bpm/test_[name].py`

**Commit message format:**
`[type]([pod-scope]): [description]`
Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
Examples: `feat(conv-ai): add escalation handler`, `test(doc-ai): add extraction accuracy harness`

## Post-plan execution choice

After saving to `docs/plans/YYYY-MM-DD-[feature].md`, present:

> **Plan saved. Two execution paths:**
>
> **1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task with two-stage review. Fast iteration, continuous checkpoints.
>
> **2. Parallel Session** — Open new session in this worktree, use `superpowers:executing-plans`. Best for long plans or overnight runs.
>
> **Which approach?**

If Subagent-Driven: invoke `provana-superpowers:subagent-driven-delivery` immediately.

## Principles

- Exact file paths always. Never "add validation" — write the code.
- DRY: if a pattern repeats across tasks, factor it into a shared module at Task 1.
- YAGNI: no speculative features. Each task implements exactly one AC from the story.
- TDD: every task follows RED → GREEN → COMMIT. No exceptions.
- Frequent commits: each passing test gets its own commit.
