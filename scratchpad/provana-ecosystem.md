# Provana Plugin Ecosystem

Context file for the proctl CLI agent. These are the plugins that proctl will serve.
Build the tool knowing this is the real workload — the plugins must actually install cleanly.

## Plugin Catalogue

### Sprint 1 (first end-to-end)

#### `provana-core`
**Repo:** `github.com/109628/provana-core`
Foundation. Every Provana project installs this first.

| Component | Details |
|---|---|
| skill: `git-workflow` | Conventional commits, PR descriptions, branch naming |
| skill: `api-design` | REST design, OpenAPI, error schemas |
| hook: `dangerous-bash-guard` | PreToolUse / Bash — blocks destructive commands |
| hook: `lint-on-edit` | PostToolUse / Edit\|Write — triggers linting |
| Claude Code | Full support |
| Copilot | skills only |

---

### Sprint 3+ (tech stack plugins)

#### `provana-branching`
**Repo:** `github.com/109628/provana-branching`
Provana branch naming conventions + Azure DevOps push workflow.

| Component | Details |
|---|---|
| skill: `branching-conventions` | Provana branch naming rules, PR title format, ADO push workflow |
| hook: `branch-name-guard` | UserPromptSubmit — warns if branch name violates conventions |
| Claude Code | Full |
| Copilot | skills only |

#### `provana-postgres`
**Repo:** `github.com/109628/provana-postgres`
PostgreSQL development skills and tooling.

| Component | Details |
|---|---|
| skill: `schema-design` | PostgreSQL schema patterns, normalization, partitioning |
| skill: `query-patterns` | Query optimization, indexes, EXPLAIN ANALYZE |
| mcp: `postgres-helper` | stdio — parameterized query runner (reads DATABASE_URL from env) |
| hook: `migration-check` | PostToolUse / Write — warns on raw ALTER TABLE without migration file |
| Claude Code | Full |
| Copilot | skills + MCP |

#### `provana-nextjs`
**Repo:** `github.com/109628/provana-nextjs`
Next.js 14 App Router development.

| Component | Details |
|---|---|
| skill: `nextjs-patterns` | App Router, server components, data fetching, route handlers |
| skill: `component-design` | shadcn/ui patterns, Tailwind conventions, accessibility |
| hook: `eslint-on-edit` | PostToolUse / Write — runs ESLint on .tsx/.ts edits |
| Claude Code | Full |
| Copilot | skills only |

#### `provana-express`
**Repo:** `github.com/109628/provana-express`
Express.js API development.

| Component | Details |
|---|---|
| skill: `express-patterns` | Middleware, routing, error handling, auth patterns |
| skill: `api-security` | Input validation (Zod), rate limiting, CORS, helmet |
| hook: `eslint-on-edit` | PostToolUse / Write — ESLint on .js/.ts edits |
| Claude Code | Full |
| Copilot | skills only |

#### `provana-databricks`
**Repo:** `github.com/109628/provana-databricks`
Databricks CDC and data engineering.

| Component | Details |
|---|---|
| skill: `databricks-cdc` | Change Data Capture patterns, Delta Lake CDC setup |
| skill: `delta-lake-patterns` | Delta table creation, optimization, time travel, schema evolution |
| mcp: `databricks-api` | url — Databricks REST API for workspace/cluster operations |
| Claude Code | Full (Copilot not supported — data engineering context too complex for project-only scope) |

#### `provana-fastapi`
**Repo:** `github.com/109628/provana-fastapi`
Python FastAPI microservices.

| Component | Details |
|---|---|
| skill: `fastapi-patterns` | Async routes, pydantic-settings, dependency injection, uv |
| skill: `docker-setup` | Dockerfile (uv variant), docker-compose, ACA deployment |
| mcp: `langfuse` | url — Langfuse observability (self-hosted Provana instance) |
| hook: `ruff-lint` | PostToolUse / Write — runs ruff on .py edits |
| Claude Code | Full |
| Copilot | skills + MCP |

---

### Compliance & Quality (regulatory context)

#### `provana-testing`
**Repo:** `github.com/109628/provana-testing`
Unit and integration testing patterns.

| Component | Details |
|---|---|
| skill: `unit-testing` | Jest (JS/TS) + pytest (Python) patterns, coverage thresholds |
| skill: `test-strategy` | What to test, what to mock (only system boundaries), TDD flow |
| hook: `run-tests-on-push` | UserPromptSubmit — suggests test run before commit if untested files |
| Claude Code | Full |
| Copilot | skills only |

#### `provana-compliance`
**Repo:** `github.com/109628/provana-compliance`
Regulatory standards for contact center / collections industry (FDCPA, TCPA, HIPAA-adjacent).

| Component | Details |
|---|---|
| skill: `regulatory-standards` | FDCPA/TCPA rules, safe messaging patterns, audit logging requirements |
| skill: `owasp-patterns` | OWASP Top 10 awareness, secure coding checklist |
| hook: `compliance-check` | UserPromptSubmit — scans prompt for compliance-sensitive operations |
| hook: `dep-vuln-scan` | PostToolUse / Write — triggers npm audit / pip-audit on package file edits |
| Claude Code | Full |
| Copilot | skills only |

#### `provana-deploy`
**Repo:** `github.com/109628/provana-deploy`
Azure DevOps + Azure Container Apps deployment.

| Component | Details |
|---|---|
| skill: `aca-deploy` | `az containerapp` commands, env injection, health checks, scaling |
| skill: `azure-devops-push` | ADO pipeline trigger, branch → PR → merge → deploy workflow |
| hook: `deploy-safety-guard` | PreToolUse / Bash — confirm before `az` destructive commands |
| command: `/deploy-checklist` | Pre-deploy validation checklist |
| Claude Code | Full |
| Copilot | skills only |

---

### Data / AI Platform

#### `provana-livekit`
**Repo:** `github.com/109628/provana-livekit`
LiveKit voice AI agent development.

| Component | Details |
|---|---|
| skill: `livekit-agent-patterns` | Room/participant management, turn detection, interruption handling |
| skill: `cc-livekit-agent-db-api` | LiveKit agent → DB skill (existing, repacked) |
| hook: `audio-file-guard` | PreToolUse / Bash — blocks commit of .wav/.mp3 test recordings |
| Claude Code | Full |
| Copilot | skills only |

---

## Plugin Install Order (recommended for new projects)

1. `provana-core` — always first
2. `provana-branching` — before any coding
3. Domain plugin (postgres / nextjs / express / fastapi / databricks)
4. `provana-testing` — after domain plugin
5. `provana-compliance` — for all customer-facing or data-handling projects
6. `provana-deploy` — when ready to ship
