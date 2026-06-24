# provana-superpowers — How to Use This Plugin

**Version:** 1.6.0 | **Model:** Provana AI-Native Delivery v2.0

This guide takes you from installation to a production-running system. It covers every role — solo developer, frontend engineer, backend engineer, and AI engineer — and every phase from first `git init` to production monitoring.

---

## Table of Contents

1. [What this plugin is](#1-what-this-plugin-is)
2. [Installation](#2-installation)
3. [How skills work](#3-how-skills-work)
4. [Starting a new project from zero](#4-starting-a-new-project-from-zero)
5. [Solo developer — full lifecycle](#5-solo-developer--full-lifecycle)
6. [Team workflow — FE + BE + AI engineer](#6-team-workflow--fe--be--ai-engineer)
7. [Deploying to Azure](#7-deploying-to-azure)
8. [Running in production (ops + monitoring)](#8-running-in-production-ops--monitoring)
9. [Skill quick-reference](#9-skill-quick-reference)
10. [Common scenarios](#10-common-scenarios)

---

## 1. What this plugin is

`provana-superpowers` is a Claude plugin that gives any developer — working alone or in a team — a complete, structured system for delivering AI-native software projects from idea to production on Azure.

It contains **26 skills**: self-contained instruction sets that Claude loads on demand. Each skill covers one phase of the delivery lifecycle. Instead of loading everything at once (which wastes context), Claude loads only the skills relevant to what you are doing right now.

**What it replaces:**

- Having to remember methodology, quality gates, deployment sequences, and testing patterns for every task
- Ad-hoc instructions to Claude that produce inconsistent results
- Verbal handoffs between developers that lose information

**What it provides:**

- A repeatable, documented workflow from discovery to production
- Automated quality gates (secrets scanning, TDD enforcement, QA verdict requirement)
- Azure infrastructure provisioning (Container Apps, Functions, Postgres, Key Vault, DNS)
- Full QA automation including voice pipeline evaluation and synthetic user simulation
- A team collaboration model that prevents file conflicts and integration failures

---

## 2. Installation

### One-time setup

```bash
# Copy plugin to your Claude plugins directory
cp -r provana-superpowers ~/.claude/plugins/provana-superpowers

# Or for Cowork (workspace folder)
cp -r provana-superpowers /path/to/workspace/.claude/skills/provana-superpowers
```

Register in `~/.claude/settings.json`:

```json
{
  "plugins": ["provana-superpowers"]
}
```

Or install via Claude Code CLI:

```bash
claude plugin install ./provana-superpowers
```

### Verify installation

Start a Claude session and type:

```
provana-superpowers:provana-bootstrap
```

You should see the bootstrap skill load and prompt you to configure the session. If you see an error, check the plugin path.

---

## 3. How skills work

### The loading model

The plugin uses a three-tier system:

| Tier     | What it means                                                     | Token cost                      |
| -------- | ----------------------------------------------------------------- | ------------------------------- |
| **Hot**  | Full skill loaded — detailed instructions in context              | ~600 tokens each, max 3 at once |
| **Warm** | One-line summary only — Claude knows it exists but hasn't read it | ~15 tokens each                 |
| **Cold** | Not loaded — available only if you explicitly ask for it          | 0 tokens                        |

At session start, `skill-router.sh` runs automatically. It reads your git branch name, directory structure, and source file keywords, then writes a routing recommendation to `/tmp/provana-skill-route.md`. Claude reads this and loads only the right hot skills for your current phase.

### Invoking a skill

```
provana-superpowers:[skill-name]
```

Examples:

```
provana-superpowers:provana-bootstrap
provana-superpowers:bmad-discovery
provana-superpowers:provana-tdd
provana-superpowers:azure-deployment
```

### The session start ritual

Every session — no exceptions — begins with:

```
provana-superpowers:provana-bootstrap
```

This loads your project context, runs the skill router, and establishes the quality rules for the session. Skipping it means Claude doesn't know which phase you're in and may load the wrong skills.

---

## 4. Starting a new project from zero

Use this when you have a project idea but nothing on disk yet.

### Step 1 — Run project-init

```
provana-superpowers:project-init
```

You will be asked for:

- Project name (e.g. `doc-ai-contracts`, ≤24 chars)
- Pod type: `conv_ai` (voice/chat), `doc_ai` (document extraction), or `bpm` (process automation)
- Azure environment: `dev`
- Azure region: `eastus2` (recommended)
- Azure subscription ID
- Alert email

The skill produces a single copy-paste bash block that:

1. Creates the git repo with correct branch structure (`main` → `develop`)
2. Copies `CLAUDE.md` and context templates into place
3. Creates the standard directory structure (`src/`, `tests/`, `docs/`, `reviews/`, `reports/`, `.worktrees/`)
4. Sets up hooks (pre-commit, secrets scanner, quality gate)
5. Creates the Azure Resource Group
6. Seeds `.env.azure.dev` (never committed — listed in `.gitignore`)

After running it, your project is ready for development. No manual assembly.

### Step 2 — Write the PRD

```
provana-superpowers:bmad-discovery
```

This walks you through the BMAD methodology: Analyst → PM → Architect persona sequence. At the end you have `docs/PRD.md` (problem, goals, non-goals, success metrics) ready for the architecture phase.

### Step 3 — Write the architecture plan

```
provana-superpowers:writing-provana-plans
```

Produces `docs/arch.md` and `docs/plans/sprint-1.md` — the structured delivery plan your subagents will execute against.

---

## 5. Solo developer — full lifecycle

This is the end-to-end path for one developer running the entire project.

### Phase map

```
project-init → bmad-discovery → writing-provana-plans
     ↓
parallel-build (optional: multiple tracks)
     ↓
subagent-driven-delivery + provana-tdd (per task)
     ↓
agent-qc-harness → requesting-provana-review
     ↓
azure-deployment + azure-cicd
     ↓
agentic-sre-runbook + llmops-alert-response (ongoing)
```

### Building: single track

For a single story:

```
provana-superpowers:provana-tdd
```

This enforces RED → GREEN → REFACTOR on every task. You never write implementation before a failing test. The pre-commit hook blocks commits that violate this.

### Building: multiple tracks in parallel

When you have 3+ stories in the same sprint that don't share files:

```
provana-superpowers:parallel-build
```

The skill guides you through:

1. **File ownership map** — assign each source directory to exactly one track before creating worktrees
2. **Worktree creation with consent gate** — you approve before any worktree is created
3. **Subagent dispatch** — each track runs as an independent `Task(general-purpose)` subagent with a self-contained prompt
4. **Monitoring** — check progress without interrupting running subagents
5. **Merge order** — infrastructure first, then features, integration test after all merged
6. **Cleanup** — remove worktrees only after verifying commits are in `develop`

**Example parallel sprint:**

```
Track A: feat/doc-ai-upload-api       → backend API for file upload
Track B: feat/doc-ai-extraction       → AI extraction pipeline  
Track C: infra/postgres-pgvector      → Azure Postgres + pgvector extension
```

Track C (infra) merges first. Tracks A and B run simultaneously, merge in any order, then the integration test runs on `develop`.

### QA: verifying a story

```
provana-superpowers:agent-qc-harness
```

Dispatches a QA subagent that generates acceptance criteria tests, runs them, and produces a `reports/qc-report-[story].md` with a PASS/FAIL verdict. The post-test hook reads this verdict — a FAIL blocks the merge.

### QA: Playwright UI testing

```
provana-superpowers:qa-automation
```

Provides the full Playwright framework with human-mimicking behaviour: five synthetic user personas (Power User, Novice, Distracted, Mobile User, Frustrated), realistic typing with typo/backspace simulation, imprecise click targeting, and network degradation testing. Accessibility audit via axe-playwright runs as a hard CI failure.

### QA: voice pipeline testing (Conv.AI projects only)

```
provana-superpowers:voice-pipeline-eval
```

Runs STT Word Error Rate (target <5% clean, <10% telephony), intent accuracy (100% on escalation triggers, >95% on critical intents), TTS naturalness scoring via librosa, multi-turn conversation flow tests, and end-to-end latency profiling (p50/p95/p99).

### PR review

```
provana-superpowers:requesting-provana-review
```

Dispatches a code reviewer subagent using the `code-reviewer.md` persona. Reviews for security (secrets, injection, input validation), performance (N+1 queries, unbounded loops), correctness (error handling, edge cases), and test coverage. Returns an APPROVE, REQUEST CHANGES, or BLOCK verdict.

### Requirements changed mid-sprint

```
provana-superpowers:mid-sprint-change
```

Never accept a verbal scope change. This skill produces an impact analysis (what breaks, what tests need updating, what the estimate change is) before a single line of code changes.

---

## 6. Team workflow — FE + BE + AI engineer

### The core rule

Each developer owns their directory. No developer edits another's directory without a formal PR. Shared files (schemas, contracts, `requirements.txt`) always change via PR reviewed by all affected parties.

### Sprint kickoff (all three together)

Before any coding begins, one session produces the **file ownership map** and **interface contracts**:

```
provana-superpowers:team-collaboration
```

This produces:

- `docs/plans/sprint-N-ownership.md` — who owns which directories
- `src/api/contracts.py` — BE publishes API request/response shapes (FE and AI code against this)
- `src/[pod]/interface.py` — AI engineer publishes the AI service interface (BE codes against this)

Once contracts exist, all three engineers develop in parallel without waiting for each other.

### Each engineer's daily session start

Everyone runs this, in their own Claude session, on their own branch:

```
provana-superpowers:provana-bootstrap
```

Then loads their role-specific skills:

**Frontend engineer:**

```
provana-superpowers:provana-tdd
provana-superpowers:qa-automation
```

**Backend engineer:**

```
provana-superpowers:provana-tdd
provana-superpowers:subagent-driven-delivery
```

**AI engineer:**

```
provana-superpowers:provana-tdd
provana-superpowers:conv-ai-scaffold    ← or doc-pipeline-scaffold
provana-superpowers:voice-pipeline-eval ← Conv.AI only
```

### Branch strategy

```
main
  └── develop                    ← integration branch
        ├── feat/fe-[story]      ← Frontend engineer's branch
        ├── feat/be-[story]      ← Backend engineer's branch
        └── feat/ai-[story]      ← AI engineer's branch
```

Each engineer rebases onto `develop` at the start of every day:

```bash
git fetch origin
git rebase origin/develop
```

### Integration testing

After any two branches merge to `develop`:

```bash
git checkout develop
pytest tests/integration/ -v -k "frontend_backend or backend_ai or end_to_end"
```

Integration test failures are assigned by the ownership map — an API contract mismatch is owned by both the publisher (BE) and the caller (FE or AI).

### When one engineer needs a stub from another

If the AI engineer needs a BE endpoint that doesn't exist yet, they dispatch a subagent rather than blocking:

```
Task(general-purpose): "Create a stub POST /api/v1/ai/callback endpoint.
  Work only in: src/api/handlers/ai_callback.py, tests/api/test_ai_callback.py
  Return { acknowledged: true } always.
  Follow provana-tdd RED first.
  Do NOT touch any other files."
```

The real implementation replaces the stub later — the contract and tests already exist.

---

## 7. Deploying to Azure

### First-time infrastructure provisioning

```
provana-superpowers:azure-deployment
```

Runs 11 numbered steps in order:

| Step            | What it creates                                              |
| --------------- | ------------------------------------------------------------ |
| 01-foundation   | Resource Group, Log Analytics, seeds `.env.azure.[env]`      |
| 02-acr          | Azure Container Registry with private endpoint               |
| build-push      | Docker build → tag → push to ACR                             |
| 04-function-app | Azure Functions (Elastic Premium, VNet integrated)           |
| 05-storage      | Storage Account (ZRS, private endpoint, 3 containers)        |
| 06-postgres     | PostgreSQL Flexible Server + pgvector extension + HA         |
| 07-keyvault     | Key Vault (RBAC model, private endpoint, all secrets stored) |
| 08-rbac         | All managed identity → resource role assignments             |
| 09-ingress      | Static public IP + WAF_v2 Application Gateway                |
| 10-dns          | Azure DNS A record registration                              |
| 11-monitoring   | Application Insights + alert rules                           |

Each step appends its outputs to `.env.azure.[env]` so subsequent steps consume them automatically. Run `deploy-all.sh` to execute the full sequence.

Or use the single-command Bicep alternative:

```bash
az deployment group create \
  --resource-group rg-[project]-[env] \
  --template-file skills/azure-deployment/bicep/main.bicep \
  --parameters @skills/azure-deployment/bicep/main.parameters.json
```

### Automated CI/CD pipeline

```
provana-superpowers:azure-cicd
```

Generates a complete `azure-pipelines.yml` with:

- **Quality Gate stage** — lint (ruff + mypy), unit tests, Provana post-test.sh quality gate. Every PR runs this.
- **Build stage** — Docker build and push to ACR. Runs on `develop` and `main` pushes.
- **Deploy Dev stage** — Updates the dev Container App. Runs on `develop` merges.
- **Deploy Staging → Prod stages** — Runs on `main` merges with manual approval gate before production.

**Rollback** (Container Apps):

```bash
# List recent revisions
az containerapp revision list \
  --name "[project]-prod-ca" \
  --resource-group "rg-[project]-prod" \
  --output table

# Activate previous revision
az containerapp revision activate \
  --name "[project]-prod-ca" \
  --resource-group "rg-[project]-prod" \
  --revision [PREVIOUS_REVISION_NAME]
```

---

## 8. Running in production (ops + monitoring)

### Production incident

```
provana-superpowers:agentic-sre-runbook
```

Classifies the incident by severity (P0–P3), provides a structured triage sequence per pod type (Conv.AI fault isolation: STT → LLM → TTS; Doc.AI: ingestion → extraction → output), and produces a blameless postmortem template appended to `docs/postmortems/`.

### LLMOps alerts (token cost, accuracy drift, hallucination)

```
provana-superpowers:llmops-alert-response
```

Covers: cost spike root cause analysis (context bloat vs traffic vs prompt length), 7-day accuracy drift query via Azure Monitor, hallucination spike P0 escalation path, and prompt version rollback procedure. All incidents are logged in `llmops/prompt_versions.log`.

### Sprint done — handoff to engineering

```
provana-superpowers:finishing-provana-branch
```

Produces the mandatory §8 handoff package: codebase + tests, CLAUDE.md token check, decisions log completeness, operational runbooks, LLMOps configuration, observability config, and an onboarding prompt that a new developer can use to self-onboard from the repo.

---

## 9. Skill quick-reference

### By lifecycle phase

| Phase                   | Skill                       | Who uses it                       |
| ----------------------- | --------------------------- | --------------------------------- |
| **New project**         | `project-init`              | Anyone starting from zero         |
| **Discovery**           | `bmad-discovery`            | PM / solo dev                     |
| **Discovery**           | `bpm-discovery`             | Pod 3 (BPM) only                  |
| **Architecture**        | `writing-provana-plans`     | Tech lead / solo dev              |
| **Team setup**          | `team-collaboration`        | All engineers together            |
| **Build (parallel)**    | `parallel-build`            | Solo dev with multiple tracks     |
| **Build (code)**        | `provana-tdd`               | Every developer, every task       |
| **Build (orchestrate)** | `subagent-driven-delivery`  | Tech lead / solo dev              |
| **Build (Conv.AI)**     | `conv-ai-scaffold`          | AI engineer, Pod 1                |
| **Build (Doc.AI)**      | `doc-pipeline-scaffold`     | AI engineer, Pod 2                |
| **Mid-sprint**          | `mid-sprint-change`         | PM / tech lead when scope shifts  |
| **QA (general)**        | `agent-qc-harness`          | QA / any developer                |
| **QA (UI)**             | `qa-automation`             | FE / QA                           |
| **QA (voice)**          | `voice-pipeline-eval`       | AI engineer, Pod 1                |
| **Review**              | `requesting-provana-review` | Developer before every PR         |
| **Deploy (infra)**      | `azure-deployment`          | Backend / DevOps                  |
| **Deploy (CI/CD)**      | `azure-cicd`                | Backend / DevOps                  |
| **Design**              | `azure-cloud-design`        | Architect / backend               |
| **Design**              | `vector-db-design`          | AI engineer / architect           |
| **Design**              | `event-driven-design`       | Backend / architect               |
| **Handoff**             | `finishing-provana-branch`  | Tech lead                         |
| **Ops**                 | `agentic-sre-runbook`       | On-call / SRE                     |
| **Ops**                 | `llmops-alert-response`     | AI engineer / LLMOps              |
| **Session**             | `provana-bootstrap`         | Everyone, every session           |
| **Meta**                | `tool-forge`                | Anyone when a domain gap is found |
| **Meta**                | `context-manager`           | Anyone when context is bloated    |

### By role

| Role             | Load at session start                 | Load when triggered                                                                      |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Solo dev**     | `provana-bootstrap`                   | Any skill per current phase                                                              |
| **Frontend**     | `provana-bootstrap`, `provana-tdd`    | `qa-automation`, `agent-qc-harness`                                                      |
| **Backend**      | `provana-bootstrap`, `provana-tdd`    | `azure-deployment`, `azure-cloud-design`, `event-driven-design`                          |
| **AI engineer**  | `provana-bootstrap`, `provana-tdd`    | `conv-ai-scaffold` or `doc-pipeline-scaffold`, `voice-pipeline-eval`, `vector-db-design` |
| **PM / QA**      | `provana-bootstrap`, `bmad-discovery` | `agent-qc-harness`, `mid-sprint-change`                                                  |
| **DevOps / SRE** | `provana-bootstrap`                   | `azure-deployment`, `azure-cicd`, `agentic-sre-runbook`                                  |

---

## 10. Common scenarios

### "I need to start a brand new project"

```
provana-superpowers:project-init
→ provana-superpowers:bmad-discovery
→ provana-superpowers:writing-provana-plans
```

### "I'm picking up a project mid-sprint as a new developer"

```
provana-superpowers:provana-bootstrap
```

Bootstrap reads the project CLAUDE.md, decisions log, and running story files. It tells you exactly what phase the project is in and which skills to load.

### "I have 3 stories to build this sprint and I'm working alone"

```
provana-superpowers:parallel-build
```

Create 3 worktrees, dispatch 3 subagents simultaneously. Each subagent works on one story. You review and merge when they complete.

### "My frontend, backend, and AI engineers are starting a sprint together"

```
[One session, Sprint kickoff]
provana-superpowers:team-collaboration
```

Produces the file ownership map and interface contracts. After this, all three engineers open their own sessions and work independently.

### "Tests are passing but I want a QA check before the PR"

```
provana-superpowers:agent-qc-harness
```

### "I need to deploy the application to Azure for the first time"

```
provana-superpowers:azure-deployment
```

Run steps 01 through 11 in order. The `deploy-all.sh` script orchestrates the whole sequence. Estimated time: 25–35 minutes for a full stack.

### "I need automated deployments on every PR"

```
provana-superpowers:azure-cicd
```

Generates `azure-pipelines.yml`. Replace `REPLACE_PROJECT` and `REPLACE_SERVICE_CONNECTION` tokens, commit, and register the pipeline.

### "Production is down"

```
provana-superpowers:agentic-sre-runbook
```

### "The LLM accuracy has dropped / costs have spiked"

```
provana-superpowers:llmops-alert-response
```

### "The client changed requirements after we started building"

```
provana-superpowers:mid-sprint-change
```

Never implement scope changes without running this first. It produces an impact analysis that the PM must sign off on before any code changes.

### "I need to add a capability the plugin doesn't have"

```
provana-superpowers:tool-forge
```

Guides you through building a new skill, hook, or reference file. The new skill is automatically integrated into the plugin and added to the skill index.

### "My context window feels bloated and Claude is getting confused"

```
provana-superpowers:context-manager
```

Audits the current hot skill set, identifies what can be evicted, and brings token usage back under budget.

---

## Hooks that run automatically

These run without you invoking them — they are wired into the Claude lifecycle via `hooks/settings.json`:

| Hook                    | Trigger                 | What it does                                                                 |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `skill-router.sh`       | Session start           | Classifies phase, writes skill routing recommendation                        |
| `secrets-scanner.sh`    | Before any bash command | Blocks if secrets patterns found in staged files                             |
| `injection-detector.sh` | Before any bash command | Blocks prompt injection in tool arguments                                    |
| `pre-commit.sh`         | Before every commit     | Secrets scan, debug artifacts, TDD discipline, pytest, commit message format |
| `post-test.sh`          | After test runs         | Reads pytest result + QC report + review verdict — blocks merge if any fail  |
| `doc-drift.sh`          | After file edits        | Warns if `docs/arch.md` not updated when `src/` changes                      |
| `mem-compile.sh`        | Session end             | Compiles memory artifacts for the next session                               |
| `board-sync.sh`         | Session end             | Syncs story status to Azure Boards                                           |

---

## The quality gate chain

Every story passes through this chain before it reaches production:

```
Write RED test → implement to GREEN → refactor
        ↓
   pre-commit.sh (secrets, debug artifacts, TDD check, pytest)
        ↓
   post-test.sh (pytest exit code + QC report verdict + review verdict)
        ↓
   agent-qc-harness (PM/QA PASS required)
        ↓
   requesting-provana-review (APPROVE required)
        ↓
   azure-pipelines.yml Quality Gate stage
        ↓
   Deploy Dev → Deploy Staging (smoke + integration) → Manual approval → Deploy Prod
```

Any failure at any stage stops the flow. The system is designed so that defects are caught as early as possible — a failing test in `pre-commit.sh` costs seconds; a production incident costs hours.

---

*provana-superpowers v1.6.0 — Provana Core AI team*
