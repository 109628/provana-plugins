# provana-superpowers — Install Guide

**Version:** 1.5.0
**Requires:** superpowers v5.1.0+ / Claude Code / Cowork

---

## What's in this plugin

25 skills in three groups:

**Provana delivery skills** (14) — AI-Native Delivery Model v2.0:

| Skill | Phase | Scope |
|-------|-------|-------|
| `provana-bootstrap` | Session start | All |
| `bmad-discovery` | Discovery + Spec | All |
| `writing-provana-plans` | Architecture | All |
| `subagent-driven-delivery` | Build | All |
| `provana-tdd` | Build | All |
| `conv-ai-scaffold` | Build | Pod 1 only |
| `doc-pipeline-scaffold` | Build | Pod 2 only |
| `bpm-discovery` | Discovery | Pod 3 only |
| `agent-qc-harness` | QA + Verify | All |
| `mid-sprint-change` | Mid-sprint | All |
| `requesting-provana-review` | QA + Verify | All |
| `agentic-sre-runbook` | Ops | All |
| `llmops-alert-response` | Ops | All |
| `finishing-provana-branch` | Go-live + Handoff | All |

**General system design skills** (8) — any project, any cloud:

| Skill | Domain | Covers |
|-------|--------|--------|
| `azure-cloud-design` | Azure cloud | Event Hub, Event Grid, Service Bus, Functions, Cosmos DB, Azure AI Search, AKS, Container Apps |
| `azure-deployment` | Azure provisioning | End-to-end az CLI + Bicep: containers, functions, storage, postgres, Key Vault, DNS, monitoring |
| `azure-cicd` | Azure DevOps | Pipeline YAML generator: build → test (quality gate) → deploy per environment, rollback |
| `vector-db-design` | Vector DB / RAG | MongoDB Atlas Vector Search, Azure AI Search, pgvector, chunking, re-ranking, evaluation |
| `event-driven-design` | Distributed systems | Outbox pattern, CQRS, Saga, Event Sourcing, Competing Consumers, schema evolution |
| `qa-automation` | Playwright / desktop | Human-mimicking synthetic users, personas, accessibility, visual regression, network degradation |
| `voice-pipeline-eval` | Voice pipeline QA | STT WER, intent accuracy, TTS naturalness, multi-turn flows, latency profiling |
| `tool-forge` | Meta / self-extension | Build new skills, hooks, and references on demand when a domain gap is found |

**Solo developer productivity skills** (3):

| Skill | When | What it does |
|-------|------|-------------|
| `project-init` | New project from zero | Bootstrap git repo, Azure RG, CLAUDE.md, hooks, directory structure in one command |
| `parallel-build` | Sprint with multiple tracks | Worktree + subagent orchestration pattern for 3-4 concurrent tracks, merge strategy, conflict prevention |
| `context-manager` | Context bloat or manual audit | Three-tier load/evict management, token budget enforcement, session state |

Plus: 10 hook scripts, 7 context templates, 3 reference files.

---

## Installation

### Step 1: Copy the plugin to your Claude plugins directory

```bash
# Find your Claude plugins directory
# Claude Code: ~/.claude/plugins/
# Cowork: [workspace]/.claude/skills/

cp -r "provana-superpowers" ~/.claude/plugins/provana-superpowers
```

### Step 2: Register the plugin

In your `~/.claude/settings.json` or Cowork plugin settings, add:

```json
{
  "plugins": [
    "provana-superpowers"
  ]
}
```

Or install via Claude Code CLI:
```bash
claude plugin install ./provana-superpowers
```

### Step 3: Set up each project repo

For each Provana AI project, copy the context template to the project root:

```bash
cp ~/.claude/plugins/provana-superpowers/context-templates/CLAUDE.md ./CLAUDE.md
```

Then edit `CLAUDE.md` — replace all `[PLACEHOLDER]` values:
- Project name and pod type
- Client name and sprint number
- Azure Board project name
- Repository structure (update to match actual structure)
- Key contacts (PM/QA, Agentic SRE lead, LLMOps)

### Step 4: Copy context templates to docs/

```bash
mkdir -p docs/plans docs/llmops docs/postmortems docs/patterns llmops reports reviews

# Copy spec templates
cp ~/.claude/plugins/provana-superpowers/context-templates/PRD.md docs/PRD.md
cp ~/.claude/plugins/provana-superpowers/context-templates/decisions.md docs/decisions.md
cp ~/.claude/plugins/provana-superpowers/context-templates/arch.md docs/arch.md

# Copy QA templates (name per story)
# cp context-templates/story-template.md docs/story-001.md
# cp context-templates/qa-plan.md docs/qa-plan-001.md
```

### Step 5: Copy hooks to project

```bash
mkdir -p hooks
cp ~/.claude/plugins/provana-superpowers/hooks/*.sh hooks/
cp ~/.claude/plugins/provana-superpowers/hooks/settings.json hooks/
chmod +x hooks/*.sh
```

Configure environment variables (never committed to git):

```bash
# Create .env (add to .gitignore immediately)
cat > .env << 'EOF'
AZURE_ORG=your-azure-org
AZURE_PROJECT=your-project-name
AZURE_WORKSPACE=your-log-analytics-workspace-id
SERVICE_NAME=your-service-name
EOF

echo ".env" >> .gitignore
```

### Step 6: Set up the LLMOps prompt versions log

```bash
mkdir -p llmops
cat > llmops/prompt_versions.log << 'EOF'
# Prompt versions log — append-only
# Format: [DATE] VERSION [prompt-name] [accuracy] [latency] [notes]
# Example:
# [2026-05-01] v1.0 invoice-extraction accuracy=91.2% latency=380ms Initial deployment
EOF
```

### Step 7: Create .gitignore additions

```bash
cat >> .gitignore << 'EOF'
# Provana
.env
.env.*
*.secrets
/tmp/provana-*
/reports/*.tmp
EOF
```

---

## First use

Start a new Claude session in the project root and run:

```
provana-superpowers:provana-bootstrap
```

This will:
- Load your `CLAUDE.md` project context
- Sync Azure Board (if MCP connected)
- Load the decisions log
- Establish skill discipline for the session
- Guide you through onboarding if it's a new project

---

## Skill invocation reference

Skills are invoked as: `provana-superpowers:[skill-name]`

| Shortcut | Full invocation |
|---------|----------------|
| **New project from zero** | `provana-superpowers:project-init` |
| Start session | `provana-superpowers:provana-bootstrap` |
| New feature | `provana-superpowers:bmad-discovery` |
| Write a plan | `provana-superpowers:writing-provana-plans` |
| **Run parallel tracks** | `provana-superpowers:parallel-build` |
| Run the build | `provana-superpowers:subagent-driven-delivery` |
| Write/run tests | `provana-superpowers:provana-tdd` |
| QA this story | `provana-superpowers:agent-qc-harness` |
| Scope changed | `provana-superpowers:mid-sprint-change` |
| Ready to merge | `provana-superpowers:requesting-provana-review` |
| **Set up CI/CD pipeline** | `provana-superpowers:azure-cicd` |
| Deploy to Azure | `provana-superpowers:azure-deployment` |
| Production down | `provana-superpowers:agentic-sre-runbook` |
| Alert fired | `provana-superpowers:llmops-alert-response` |
| Sprint done | `provana-superpowers:finishing-provana-branch` |

---

## Version notes (v5.1.0 compliance)

This plugin complies with superpowers v5.1.0 breaking changes:

- **No named agents**: `superpowers:code-reviewer` is removed. Code review uses `Task(general-purpose)` dispatched with the prompt template in `skills/requesting-provana-review/references/code-reviewer.md`.
- **Worktree consent gate**: No worktree is created without explicit human consent. All worktrees go to `.worktrees/` for provenance-based cleanup.
- **Legacy slash commands removed**: `/brainstorm`, `/execute-plan`, `/write-plan` are not present. Use the skill invocations above.

---

## Directory structure (after install)

```
your-project/
├── CLAUDE.md                          ← copied from context-templates/CLAUDE.md
├── .gitignore                         ← includes .env
├── .env                               ← AZURE_ORG, AZURE_WORKSPACE (not committed)
├── hooks/
│   ├── settings.json                  ← hook activation config
│   ├── pre-commit.sh
│   ├── post-test.sh
│   ├── board-sync.sh
│   ├── mem-compile.sh
│   ├── doc-drift.sh
│   ├── arch-notify.sh
│   ├── sre-runbook-gen.sh
│   ├── llmops-alert.sh
│   ├── secrets-scanner.sh
│   └── injection-detector.sh
├── llmops/
│   └── prompt_versions.log
├── src/
│   └── [pod]/                         ← conv_ai / doc_ai / bpm
├── tests/
│   └── [pod]/
├── docs/
│   ├── PRD.md
│   ├── decisions.md
│   ├── arch.md
│   ├── plans/
│   ├── llmops/
│   └── postmortems/
├── reports/
└── reviews/
```

---

## Reference files

| File | Purpose |
|------|---------|
| `references/skills-taxonomy.md` | Full producer/consumer map for all skills |
| `references/pod-skills-map.md` | Pod-specific skill guide by phase |
| `references/handoff-checklist.md` | §8 handoff checklist (print and check off) |
| `skills/requesting-provana-review/references/code-reviewer.md` | Code reviewer persona and checklist |
