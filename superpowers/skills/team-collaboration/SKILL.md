---
name: team-collaboration
description: Use when 2+ developers (FE, BE, AI engineer) work on the same project at once. Defines file ownership boundaries and integration cadence to prevent merge conflicts and context collisions. Trigger on "multiple devs working together", "set up the project for team collaboration", "FE plus BE plus AI engineer".
---

# team-collaboration — Multi-Developer Workflow

> Invoke when: 2+ developers (frontend, backend, AI engineer, etc.) are working on the same project simultaneously.
> Prevents interference, defines ownership boundaries, and coordinates integration without a team lead bottleneck.

---

## When to invoke

- "Multiple devs working together"
- "How does the frontend dev work alongside the AI engineer?"
- "Set up the project for team collaboration"
- "We have FE + BE + AI engineers on this sprint"
- `provana-superpowers:team-collaboration`

---

## The core problem

When 3 developers work on the same repo, three things break:

1. **File conflicts** — two people edit the same file, git merge breaks
2. **Context collisions** — one developer's Claude session picks up another's in-progress state
3. **Integration failures** — code that works in isolation breaks when combined

This skill solves all three systematically.

---

## Role definitions

| Role | Owns | Claude Session Focus |
|------|------|---------------------|
| **Frontend Engineer** | `src/frontend/`, `tests/frontend/`, `public/`, CSS/templates | UI skill (qa-automation, Playwright) |
| **Backend Engineer** | `src/api/`, `src/services/`, `src/models/`, `tests/api/` | provana-tdd, azure-deployment |
| **AI Engineer** | `src/conv_ai/` or `src/doc_ai/`, `src/pipelines/`, `tests/ai/` | Pod scaffold skill, voice-pipeline-eval or qa-automation |

Each developer owns their directory completely. **No developer edits another's directory without a formal handoff.**

---

## Step 1 — Sprint kickoff: divide the story map

Before writing any code, the team (or PM/QA with bmad-discovery) produces a **file ownership map** in `docs/plans/sprint-[N]-ownership.md`:

```markdown
# Sprint [N] — File Ownership Map

## Frontend (FE)
Owns exclusively:
- src/frontend/**
- tests/frontend/**
- public/**

Reads (never writes):
- src/api/routes.py          ← to know API contract
- src/models/schemas.py      ← to know data shapes

## Backend (BE)
Owns exclusively:
- src/api/**
- src/services/**
- src/models/**
- tests/api/**
- tests/unit/**

Reads (never writes):
- src/conv_ai/client.py      ← to know AI service interface
- src/frontend/types.ts      ← to know expected response shape

## AI Engineer (AI)
Owns exclusively:
- src/conv_ai/**  (or src/doc_ai/**)
- src/pipelines/**
- tests/ai/**
- docs/llmops/**

Reads (never writes):
- src/models/schemas.py      ← to know input/output contract

## Shared files (change requires PR + all affected parties review)
- src/models/schemas.py      ← owned by BE, AI must open a PR to change
- docs/arch.md               ← any team member can propose changes via PR
- docs/decisions.md          ← append-only, any team member writes
- requirements.txt           ← BE owns, others open PR for additions
- azure-pipelines.yml        ← BE owns
```

**Rule: shared files use PRs, never direct commits.**

---

## Step 2 — Branch strategy

Each developer works on their own branch. Merges go to `develop` via PR.

```
main
  └── develop                    ← integration branch
        ├── feat/fe-[story-id]   ← Frontend engineer
        ├── feat/be-[story-id]   ← Backend engineer
        └── feat/ai-[story-id]   ← AI engineer
```

```bash
# Each developer runs on their own machine / session:

# Frontend engineer
git checkout develop
git checkout -b feat/fe-[story-id]

# Backend engineer  
git checkout develop
git checkout -b feat/be-[story-id]

# AI engineer
git checkout develop
git checkout -b feat/ai-[story-id]
```

**Branches never merge directly into each other.** All merges go to `develop`. The integration test on `develop` is the collision detector.

---

## Step 3 — Each developer's Claude session setup

Each developer runs their own Claude session against their own branch. They load only the skills relevant to their role.

### Frontend engineer session

```
[Start session in project root, on branch feat/fe-[story-id]]

provana-superpowers:provana-bootstrap

My role: Frontend Engineer
My branch: feat/fe-[story-id]
My owned directories: src/frontend/, tests/frontend/, public/
Story: [paste story text]

Load: provana-superpowers:provana-tdd
Then: provana-superpowers:qa-automation (for UI/Playwright tests)
```

Skill-router will detect the branch name containing `feat` and load the build phase hot skills. The FE engineer never needs `conv-ai-scaffold` or `azure-deployment` — those stay cold.

### Backend engineer session

```
[Start session in project root, on branch feat/be-[story-id]]

provana-superpowers:provana-bootstrap

My role: Backend Engineer
My branch: feat/be-[story-id]
My owned directories: src/api/, src/services/, src/models/, tests/
Story: [paste story text]

Load: provana-superpowers:provana-tdd
Load: provana-superpowers:azure-deployment (if infra changes needed)
```

### AI engineer session

```
[Start session in project root, on branch feat/ai-[story-id]]

provana-superpowers:provana-bootstrap

My role: AI Engineer
My branch: feat/ai-[story-id]  
My owned directories: src/conv_ai/, tests/ai/, docs/llmops/
Story: [paste story text]

Load: provana-superpowers:provana-tdd
Load: provana-superpowers:conv-ai-scaffold  (or doc-pipeline-scaffold)
Load: provana-superpowers:voice-pipeline-eval  (if Conv.AI pod)
```

**Each session is fully isolated.** There is no shared Claude context between developers. Each developer's session reads their own branch, their own CLAUDE.md, their own story file.

---

## Step 4 — Interface contracts (prevent integration failures)

The most common integration failure: frontend calls an API that doesn't exist yet, or AI returns a schema the backend doesn't expect. Solve this upfront — in the same sprint kickoff session.

**Backend publishes the API contract before coding begins:**

```python
# src/api/contracts.py — written by BE at sprint start, read-only for FE
# This is the source of truth. FE codes against this. BE implements against this.

from pydantic import BaseModel
from typing import Optional, List

class DocumentUploadRequest(BaseModel):
    file_name: str
    content_base64: str
    document_type: str  # "invoice" | "contract" | "form"

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str         # "queued" | "processing" | "complete" | "failed"
    estimated_seconds: int

class ExtractionResult(BaseModel):
    document_id: str
    fields: dict
    confidence: float   # 0.0 – 1.0
    errors: List[str]
```

**AI engineer publishes the AI service interface before coding begins:**

```python
# src/conv_ai/interface.py — written by AI eng at sprint start, read-only for BE
# BE calls this interface. AI eng implements it.

from abc import ABC, abstractmethod
from typing import AsyncIterator

class ConvAIServiceInterface(ABC):

    @abstractmethod
    async def process_turn(
        self,
        session_id: str,
        user_input: str,
        context: dict
    ) -> AsyncIterator[str]:
        """Stream response tokens. Raises ConvAIError on failure."""
        ...

    @abstractmethod
    async def end_session(self, session_id: str) -> None:
        ...
```

Once contracts exist, all three engineers can code in parallel without waiting for each other — they code against the interface, not the implementation.

---

## Step 5 — Handling shared file changes

When a developer needs to change a shared file (e.g., `src/models/schemas.py`), the workflow is:

```
1. Developer opens a PR against develop with ONLY the shared file change
2. PR description explains: "Adding field X to DocumentSchema — needed by AI pipeline"
3. All affected parties review (FE + AI in this case)
4. PR merges first, before the feature branch
5. Feature branches rebase onto develop to pick up the change:
   git rebase develop
```

**Never batch a shared file change with feature code.** Keep it atomic so reviewers can evaluate the impact cleanly.

---

## Step 6 — Daily sync: keep branches current

Each developer rebases onto `develop` at the start of their day:

```bash
# Each developer runs this at session start
git fetch origin
git rebase origin/develop

# If conflicts:
git status        # see conflicted files
# Resolve — you should only ever conflict on shared files (Step 5)
git rebase --continue

# Verify tests still pass
pytest tests/[your-area]/ -q
```

This keeps divergence small. A rebase done daily takes seconds. A rebase done after 2 weeks takes hours.

---

## Step 7 — PR and review process

When a developer's story is complete:

```bash
# From your feature branch
bash hooks/post-test.sh    # Provana quality gate — must pass

# Push and open PR
git push -u origin feat/[role]-[story-id]
```

Then invoke the review skill — but with role-appropriate reviewers:

```
provana-superpowers:requesting-provana-review
```

In the PR description, tag the specific directories you changed. Reviewers only need to check their intersection:

```markdown
## Files changed
- src/api/handlers/upload.py    ← BE review required
- src/api/contracts.py          ← ALL review required (shared file)
- tests/api/test_upload.py      ← BE review

No frontend or AI files changed.
```

---

## Step 8 — Integration testing on develop

After two or more PRs merge to `develop`, run the cross-role integration test:

```bash
git checkout develop
git pull origin develop

# Full suite — all three domains together
pytest tests/ -v --tb=short

# Specific cross-role integration tests
pytest tests/integration/ -v -k "frontend_backend or backend_ai or end_to_end"
```

**Who owns integration test failures?**

| Failure type | Owner |
|--------------|-------|
| API contract mismatch | Both BE and the caller (FE or AI) — fix the contract together |
| Auth/session propagation | BE |
| UI renders wrong data | FE |
| AI response schema drift | AI engineer |
| Database migration missing | BE |

Document the root cause in `docs/decisions.md` after resolution.

---

## Step 9 — Cross-role subagent dispatch

Sometimes one developer needs work done in another developer's domain — for example, the AI engineer needs a new API endpoint the backend engineer hasn't built yet. Rather than blocking, they dispatch a subagent:

```python
# AI engineer dispatches a subagent to stub the BE endpoint
Task(general-purpose, prompt="""
You are working in the Backend Engineer role.
Worktree: [repo root, branch feat/be-stub-ai-callback]
File ownership: src/api/handlers/ai_callback.py, tests/api/test_ai_callback.py

Task: Create a stub POST /api/v1/ai/callback endpoint that:
- Accepts: { session_id: str, result: dict, status: str }
- Returns: { acknowledged: bool }
- Has a unit test: test_ai_callback_returns_acknowledged
- Implementation is a stub (returns {"acknowledged": true} always)
- Follows provana-tdd RED first

Exit criteria: pytest tests/api/test_ai_callback.py passes
Do NOT touch any other files.
""")
```

The AI engineer then codes against this stub. When the BE engineer is ready, they replace the stub with the real implementation — the tests already exist and will catch any contract drift.

---

## Common failure modes and fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| Merge conflict on `src/models/schemas.py` | Two devs edited shared file directly | Revert one, open a PR for the shared change (Step 5) |
| Integration test fails after FE merge | FE called a BE endpoint with wrong params | Check `contracts.py` — FE used stale contract. Rebase and fix. |
| AI service returns unexpected schema | AI engineer changed interface without PR | Enforce: `src/conv_ai/interface.py` is a shared file. Any change needs a PR. |
| Dev A's Claude session reads Dev B's test reports | Both sessions at repo root reading same `reports/` dir | Each developer creates `reports/[role]/` subfolder. Skill-router reads `reports/[role]/qc-report-*.md`. |
| Two devs modify `requirements.txt` in parallel | Standard merge conflict | BE owns requirements.txt. Others open a PR to add deps. |
| CI pipeline fails on develop after 3 merges in one day | No intermediate integration test | Each merge to develop triggers the pipeline. Fix the failing merge before the next one lands. |

---

## Quick-reference: who loads what

| Skill | FE | BE | AI Eng |
|-------|----|----|--------|
| `provana-bootstrap` | ✅ | ✅ | ✅ |
| `provana-tdd` | ✅ | ✅ | ✅ |
| `writing-provana-plans` | — | ✅ (leads arch) | ✅ (AI arch) |
| `subagent-driven-delivery` | optional | ✅ | ✅ |
| `qa-automation` | ✅ | — | optional |
| `conv-ai-scaffold` | — | — | ✅ (Pod 1) |
| `doc-pipeline-scaffold` | — | — | ✅ (Pod 2) |
| `voice-pipeline-eval` | — | — | ✅ (Pod 1) |
| `azure-deployment` | — | ✅ | — |
| `azure-cicd` | — | ✅ | — |
| `azure-cloud-design` | — | ✅ | ✅ |
| `vector-db-design` | — | optional | ✅ |
| `agent-qc-harness` | ✅ | ✅ | ✅ |
| `requesting-provana-review` | ✅ | ✅ | ✅ |
| `agentic-sre-runbook` | — | ✅ | ✅ |
| `llmops-alert-response` | — | — | ✅ |
| `team-collaboration` | ✅ (ref) | ✅ (leads) | ✅ (ref) |
| `parallel-build` | — | ✅ (orchestrator) | — |

---

## Red flags

- Two developers editing the same file on different branches → guaranteed conflict. Enforce the ownership map before the sprint starts, not after.
- Developer adding `from src/other_role/` imports → cross-domain coupling. Fix the interface contract instead.
- "I'll just push directly to develop" → blocked by pre-commit.sh + branch protection rules. All changes go through PRs on develop.
- Skipping the contracts step at sprint kickoff → causes integration failures at sprint end instead of Day 1. Write contracts first, always.
- One developer's Claude session accidentally operating on the whole repo with no ownership constraint → pass explicit owned-directory constraints in every subagent prompt (Step 9 template).
