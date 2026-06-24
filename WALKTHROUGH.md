# Provana Plugins — Walkthrough

> For: Engineering leads, team onboarding, feedback sessions
> Owner: Yethu Krishnan — yethu.krishnan@provana.com

---

## 1. Why We Built This

Provana engineers, QA, and PMs work across multiple systems every day — Azure DevOps, Databricks, Langfuse, GitHub, Azure Container Apps. Getting anything done meant switching context, writing tickets manually, querying systems separately, and communicating status across tools by hand.

AI coding agents (Claude Code, Copilot) can eliminate most of that friction — but only if they know your systems, your standards, and your workflows. Out of the box, they don't.

**Provana Plugins gives every person on the team a configured AI agent that:**

- **Knows our tools** — Claude can create ADO tickets, query Databricks tables, manage Langfuse prompts, and trigger pipelines directly from the chat. No context switching.
- **Knows our standards** — code review, git workflow, API design, compliance rules — baked in, not re-explained every session.
- **Guards against mistakes** — hooks that block dangerous commands, enforce quality gates, warn before destructive operations.
- **Works for everyone** — not just engineers. QA gets test coverage guidance. PMs can use ADO skills to manage backlogs. Data team gets Databricks and SQL skills.

**One command. Fully configured. For your domain.**

```bash
proctl add core    # foundation
proctl add ado     # ADO integration
proctl add data    # Databricks + SQL
```

The goal is fewer meetings, fewer manual status updates, and fewer context switches — the agent handles the systems, the human handles the decisions.

---

## 2. What We Built

Two things in one repo (`github.com/109628/provana-plugins`):

```
provana-plugins/
├── proctl/          ← CLI tool — the installer
├── core/            ← provana-core plugin
├── design/          ← provana-design plugin
├── ado/             ← provana-ado plugin
├── quality/         ← provana-quality plugin
├── data/            ← provana-data plugin
└── langfuse/        ← provana-langfuse plugin
```

**`proctl`** = the CLI. Published to GitHub Packages as `@109628/proctl`.

**Plugins** = folders in this repo. Not published anywhere — fetched directly from GitHub at install time. No build step.

### What a plugin contains

Each plugin is a folder with `plugin.json` + assets:

```
ado/
├── plugin.json                         ← manifest: name, version, components
├── skills/
│   ├── ado-work-items/SKILL.md         ← instructions Claude follows
│   └── ado-repositories/SKILL.md
```

`plugin.json` declares 5 component types:

| Type | What it does |
|------|-------------|
| `skills` | Markdown instructions injected into Claude's context |
| `mcp_servers` | Tool integrations (Databricks, Azure DevOps, Langfuse) |
| `hooks` | Shell scripts that run on Claude events (PreToolUse, PostToolUse) |
| `commands` | Slash commands available in Claude Code (`/provana`, etc.) |
| `statusline` | Custom status bar content |

### How `proctl add` works (simplified)

```
proctl add ado
    ↓
registry.js  — fetches ado/plugin.json from github.com/109628/provana-plugins
    ↓
manifest.js  — validates the JSON, filters components
    ↓
installer.js — loops through skills, MCP, hooks
    ↓
claude-code.js adapter — writes to ~/.claude/skills/, ~/.claude/settings.json
    ↓
state.js     — records what was installed in ~/.claude/proctl/state.json
```

Everything `proctl` writes to `settings.json` carries a `__proctl` tag so it can be cleanly removed without touching anything else.

---

## 3. Setup & Installation

### Prerequisites

- Node.js 18+
- GitHub account with access to `109628/provana-plugins`
- Claude Code installed

### Step 1 — Authenticate with GitHub Packages

Add to your `~/.npmrc`:

```
@109628:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Your PAT needs: `read:packages` scope (read-only, safe to share within team).

Generate at: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → `read:packages`.

### Step 2 — Install proctl globally

```bash
npm install -g @109628/proctl@latest
proctl --version
```

### Step 3 — Install plugins

```bash
# Foundation — install first on every machine/project
proctl add core        # git workflow, API design, safety hooks
proctl add ado         # Azure DevOps MCP + skills
proctl add quality     # code review, pre-commit quality gate

# By what you're working on
proctl add design      # UI/UX, shadcn, Tailwind
proctl add data        # Databricks, CDC, SQL analytics
proctl add langfuse    # Langfuse prompt migration skill
```

### Step 4 — Restart Claude Code

Hooks and MCP servers activate on restart.

---

## 4. Authentication Details

| Plugin | Auth required | Where to configure |
|--------|--------------|-------------------|
| `ado` | Azure DevOps PAT | `AZURE_DEVOPS_PAT` env var or MCP server config |
| `data` | Databricks CLI configured | `databricks configure` (sets `~/.databrickscfg`) |
| `langfuse` | Langfuse keys | `.env` in each service — `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` |
| `core`, `design`, `quality` | None | — |

**`proctl` itself** needs `PROCTL_GITHUB_TOKEN` env var only if the repo goes private (currently public read).

---

## 5. Currently Available Plugins

### `core` — Foundation
**Install:** `proctl add core`

| Component | What it gives you |
|-----------|------------------|
| skill: `git-workflow` | Conventional commits, PR descriptions, Provana branch naming |
| skill: `api-design` | REST design, OpenAPI specs, error schemas |
| hook: `dangerous-bash-guard` | Blocks `rm -rf`, `git push --force`, destructive commands |

**Who needs it:** Everyone. Install first.

---

### `design` — UI/UX
**Install:** `proctl add design`

| Component | What it gives you |
|-----------|------------------|
| skill: `ui-ux` | Accessibility, touch targets, data tables, form patterns |
| skill: `design-system` | Provana design tokens — primitive → semantic → component |
| skill: `ui-styling` | shadcn/ui patterns, Tailwind conventions, dark mode |

**Who needs it:** Frontend engineers working on any Provana UI.

---

### `ado` — Azure DevOps
**Install:** `proctl add ado`

| Component | What it gives you |
|-----------|------------------|
| skill: `ado-work-items` | Create/update/link work items, sprint planning, queries |
| skill: `ado-repositories` | PR creation, branch policies, Provana code review workflow |
| MCP: `azure_devops` | Claude can directly read/write ADO — tickets, PRs, pipelines |

**Who needs it:** All engineers. ADO MCP means Claude can create PRs and update tickets without leaving the chat.

---

### `quality` — Code Quality
**Install:** `proctl add quality`

| Component | What it gives you |
|-----------|------------------|
| skill: `code-review` | Senior review patterns — bugs, perf, security, coverage gaps |
| skill: `test-coverage` | pytest, pytest-asyncio patterns, what/when to mock |
| hook: `pre-commit-quality-gate` | Runs before commit — warns on missing tests, lint errors |

**Who needs it:** All engineers. Especially valuable for PR reviews.

---

### `data` — Data Engineering
**Install:** `proctl add data`

| Component | What it gives you |
|-----------|------------------|
| skill: `databricks-patterns` | Delta Lake, notebooks, jobs, Unity Catalog, Spark optimization |
| skill: `cdc-patterns` | Debezium, Delta Lake CDC, streaming ingestion, schema evolution |
| skill: `data-quality` | Freshness checks, completeness validation, Great Expectations |
| skill: `sql-analytics` | Window functions, CTEs, query optimization, Spark SQL |
| MCP: `databricks` | Claude can query Delta tables, manage clusters, trigger jobs directly |

**Who needs it:** Data engineering team.

---

### `langfuse` — LLM Observability & Prompts
**Install:** `proctl add langfuse`

| Component | What it gives you |
|-----------|------------------|
| skill: `provana-langfuse-prompts` | Step-by-step guide to migrate hardcoded prompts to Langfuse, generates `prompt_service.py` |

**Use cases:**
- Migrating inline system prompts out of code into Langfuse prompt management
- Standardizing `Dev/QA` prompt naming across all services
- Teams working on cc-livekit-agent, cc-aiservices, cc-post-call-analytics

**Who needs it:** AI/ML team, any service that calls an LLM.

---

## 6. Useful Commands

```bash
# See what's installed
proctl list

# See what's available in the registry
proctl list --available 109628/provana-plugins

# Remove a plugin
proctl remove provana-ado

# Update a plugin to latest
proctl update provana-core

# Install only skills (skip MCP/hooks)
proctl add ado --only skills

# Install to a specific agent
proctl add core -a copilot

# Dry run — see what would happen without writing
proctl add data --dry-run
```

---

## 7. Feedback We're Looking For

After trying proctl and the plugins, we want to know:

1. **Missing skills** — "When I do X, Claude doesn't know Y" → we write a skill for it
2. **Wrong guidance** — skills that give incorrect or outdated advice for our stack
3. **Missing plugins** — team domains not covered yet (see future planning below)
4. **Install friction** — anything that broke or was confusing during setup
5. **Hook annoyance** — any hook that fires too aggressively or blocks legitimate work

Raise directly to Yethu or open an issue on `109628/provana-plugins`.

---

## 8. Future Planning

### Plugins being considered

| Plugin | Domain | Key skills planned |
|--------|--------|--------------------|
| `fastapi` | Python microservices | FastAPI patterns, Docker/uv setup, ruff-lint hook |
| `nextjs` | Frontend | Next.js App Router, shadcn patterns, ESLint hook |
| `databricks-advanced` | Data | Delta Live Tables, Unity Catalog governance |
| `livekit` | Voice AI | Room/participant management, turn detection, interrupt handling |
| `compliance` | Regulatory | FDCPA/TCPA rules, OWASP Top 10, dependency vuln scan hook |
| `deploy` | DevOps | Azure Container Apps deploy, ADO pipeline workflow |
| `postgres` | Backend | Schema design, query optimization, migration safety hook |

### Capability improvements planned

- **Auto-detect installed plugins** at project init and suggest what's missing
- **`proctl init` enhancements** — scaffold a full plugin from existing `~/.claude/skills`
- **Version pinning** — `proctl add core@1.0.0` for stability
- **Copilot parity** — expand hooks + commands support for GitHub Copilot

### How new plugins get added

1. New challenge identified (team struggling with X)
2. Write `SKILL.md` capturing the expert knowledge
3. Test with Claude Code — iterate until guidance is accurate
4. Create plugin folder + `plugin.json` in this repo
5. Push — immediately available via `proctl add <name>`
6. No publish step needed for plugins

---

## 9. How to Add Your Own Skill

If you have domain knowledge to capture:

```bash
# Scaffold a new plugin
proctl init my-plugin

# Edit the SKILL.md
# Push to a repo
# Install locally to test
proctl add ./my-plugin --all -a claude -y
```

Or contribute directly to this repo — open a PR with a new plugin folder.

---

## 10. Architecture Summary (for the curious)

```
proctl CLI (bin/proctl.js)
│
├── registry.js      Source resolver
│                    github:owner/repo → fetches raw files
│                    local:./path      → reads from disk
│                    bare name "core"  → auto → 109628/provana-plugins/core
│
├── manifest.js      plugin.json validator
│                    Enforces schema, filters by --only/--skill flags
│
├── installer.js     Orchestrator
│                    Loops: agents × components → installs each
│                    Records result in state.json
│
├── agents/
│   ├── claude-code.js   Writes to ~/.claude/skills/, settings.json
│   └── copilot.js       Writes to .github/copilot/skills/, .vscode/mcp.json
│
└── state.js         ~/.claude/proctl/state.json
                     Tracks: what's installed, version, which agents, components
```

**Safety guarantees:**
- Every write to `settings.json` is tagged `__proctl: "plugin-name"` — safe to remove
- Backup created before every settings write (`settings.json.proctl-bak-<timestamp>`)
- Idempotent — double install produces no duplicates
- Hooks never removed unless they carry `__proctl` tag
