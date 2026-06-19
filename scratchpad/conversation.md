# proctl — Full Project Conversation Log

Living document. Every agent that works on this project MUST read this first and
update it before finishing their session. New agents: treat this as your primary context.

---

## What is this project?

`proctl` is Provana's plugin manager CLI for AI coding agents (Claude Code + GitHub Copilot).
It installs curated Provana plugins — bundles of skills, MCP servers, hooks, commands,
statuslines — into agent config files. Users can install full plugins or cherry-pick
individual components. Plugins are GitHub repos with a `plugin.json` manifest.

**Business goal:** Replace manual copy-paste of skills/hooks/MCP config across Provana
engineering projects with a one-command install. Cover the full SDLC: project init →
coding → testing → branching → Azure DevOps push → compliance checks.

---

## Who is the user?

Yethu Krishnan — Provana India. Email: yethu.krishnan@provana.com. GitHub: `109628`.
Windows 11, PowerShell, Claude Code, GitHub CLI authenticated. Node v24, npm v11.
Works on: FastAPI microservices, LiveKit voice AI, Next.js, PostgreSQL, Databricks,
Azure Container Apps. Regulatory industry (contact center / collections — FDCPA, TCPA).

---

## Project root

`C:\Users\yethu.krishnan\OneDrive - Provana India Pvt. Ltd\Documents\Provana_Projects\provana-plugins\`

```
provana-plugins/                  ← GitHub: 109628/provana-plugins
├── core/                         ← provana-core plugin
│   ├── plugin.json
│   ├── skills/git-workflow/
│   ├── skills/api-design/
│   └── hooks/dangerous-bash-guard.ps1
│
├── design/                       ← provana-design plugin
│   ├── plugin.json
│   ├── skills/ui-ux/
│   ├── skills/design-system/
│   └── skills/ui-styling/
│
├── proctl/                       ← CLI tool (npm: @109628/proctl)
│   ├── bin/proctl.js             ← Commander.js entry point
│   ├── lib/
│   │   ├── settings.js           ← atomic JSON read/write/backup
│   │   ├── state.js              ← ~/.claude/proctl/state.json tracker
│   │   ├── manifest.js           ← plugin.json parser + validator
│   │   ├── registry.js           ← GitHub fetcher + local + named registry + subfolder lookup
│   │   ├── installer.js          ← orchestrator
│   │   ├── ui.js                 ← inquirer interactive prompts
│   │   ├── agents/
│   │   │   ├── claude-code.js    ← full adapter (skills/MCP/hooks/commands/statusline)
│   │   │   ├── copilot.js        ← skills + MCP only
│   │   │   └── index.js          ← adapter lookup, 'claude' → 'claude-code' alias
│   │   └── components/
│   │       ├── skills.js
│   │       ├── mcp.js
│   │       ├── hooks.js
│   │       ├── commands.js
│   │       └── statusline.js
│   ├── package.json              ← @109628/proctl, publishConfig → GitHub Packages
│   └── .npmrc                    ← @109628 → npm.pkg.github.com
│
└── scratchpad/                   ← spec files — READ THESE FIRST
    ├── SKILL.md                  ← primary build spec for proctl CLI
    ├── architecture.md           ← module-by-module API specs
    ├── agent-targets.md          ← Claude Code + Copilot config formats
    ├── cli-spec.md               ← full CLI argument spec, all subcommands
    ├── manifest-schema.md        ← plugin.json schema + validation rules
    ├── plugin.json               ← template for proctl init
    ├── provana-ecosystem.md      ← full plugin catalogue (what exists / planned)
    └── conversation.md           ← THIS FILE
```

---

## System architecture

```
proctl CLI
    ↓ fetches plugin.json + files from
GitHub repos (public, user: 109628)
    ↓ installs into
~/.claude/settings.json     ← MCP servers, hooks, statusline
~/.claude/skills/<name>/    ← skill SKILL.md files
~/.claude/commands/<name>.md
~/.claude/proctl/state.json ← tracks what proctl installed
~/.claude/proctl/plugins/<plugin>/ ← hook scripts, bin scripts

Phase 2 (not started):
Registry Backend (FastAPI + PostgreSQL)  ← plugin metadata + download tracking
Admin UI (Next.js)                       ← admin CRUD + analytics dashboard
```

---

## Critical design rules (always enforce)

1. **Windows paths only via `path.join(os.homedir(), '.claude', ...)`** — never `~` or hardcoded.
2. **Hook scripts are PowerShell `.ps1`** — registered as `powershell -File "<abs-path>"`.
3. **`__proctl` tag** on every entry proctl writes to settings.json — enables clean removal.
4. **Append-only hooks** — never remove hook entries without `__proctl` tag (user hooks survive).
5. **Backup before every write** — `<file>.proctl-bak-<ISOtimestamp>`.
6. **Idempotent** — double-install must not duplicate entries.
7. **Agents: Claude Code + Copilot only** — Cursor is out of scope.
8. **State file: `~/.claude/proctl/state.json`** — NOT `~/.proctl/`.
9. **Copilot: project-scoped only** — no global skills dir, writes to `.github/copilot/skills/`.
10. **Fail gracefully on unsupported components** — warn + skip, never abort install.

---

## Sprint 1 — COMPLETED (2026-06-18)

### What was built

**proctl CLI** (`provana-plugins/proctl/`)
- All commands: `add`, `remove`, `list`, `update`, `init`
- Standalone: `proctl skill add`, `proctl mcp add`, `proctl hook add`
- Registry: `proctl registry add <alias> <url>`
- Claude Code + Copilot adapters
- Deps: commander ^12, inquirer ^9 — no other runtime deps

**provana-core plugin** (https://github.com/109628/provana-core v1.0.0)
- Skills: `git-workflow`, `api-design`
- Hook: `dangerous-bash-guard.ps1` (PreToolUse / Bash matcher / async: false)
- Both skills appear live in Claude Code session after install

### E2E test results (all passing)

```
proctl add 109628/provana-core --all -a claude -y    ✓
proctl list                                           ✓  skills(2) hooks(1)
settings.json hook entry with __proctl tag            ✓
proctl remove provana-core -y                         ✓  clean, no orphans
double-install idempotent                             ✓
proctl skill add <standalone>                         ✓
proctl mcp add <name> <url>                           ✓
proctl hook add <event> <script>                      ✓
proctl registry add provana https://github.com/109628 ✓
existing user hooks preserved after install           ✓
```

### Known behavior notes

- Standalone `skill add` uses filename stem as skill name (`test-standalone.md` → `test-standalone`)
- `proctl hook remove <name>` shortcut not yet built — workaround: `proctl remove __standalone__hook__<name>`
- Initial git branch was `master`, force-renamed to `main` before push — clean

---

## Restructure to monorepo — COMPLETED (2026-06-19)

Moved from separate `109628/provana-core` repo to monorepo `109628/provana-plugins`.

**Structure now:**
```
provana-plugins/
├── core/           ← provana-core plugin (was separate repo, now subfolder)
├── proctl/         ← CLI tool
└── scratchpad/     ← spec files
```

**Install command changed:**
- Old: `proctl add 109628/provana-core`
- New: `proctl add 109628/provana-plugins --plugin core`

**proctl fixes made:**
- `registry.js`: `resolve(source, { plugin })` now looks for `<plugin>/plugin.json` in GitHub
- `installer.js`: passes `pluginFilter` to `registry.resolve`, stores `plugin` field in state
- `registry.listPlugins()`: uses GitHub API to scan subdirs for multi-plugin repos

**Old repo:** `109628/provana-core` — archived (read-only)

---

## provana-design plugin — COMPLETED (2026-06-19)

3 skills built for Provana engineering teams' UI/UX gap.

**Install:** `proctl add 109628/provana-plugins --plugin design`

| Skill | Covers |
|---|---|
| `ui-ux` | Accessibility, data tables/dashboards, forms, typography, animation, trust/compliance UX (DNC, FDCPA, consent visibility), pre-delivery checklist |
| `design-system` | 3-layer tokens (primitive→semantic→component), Tailwind config, component state specs, hardcoded-value audit commands |
| `ui-styling` | shadcn/ui component guide, TanStack Table pattern, react-hook-form+zod form pattern, dark mode, responsive utilities, anti-patterns |

**Provana-specific additions vs reference (nextlevelbuilder/ui-ux-pro-max-skill):**
- Regulatory UX rules: DNC badges, FDCPA time warnings, consent status visibility
- Data table rules tuned for agent/call data (tabular-nums, sticky headers, empty states)
- shadcn/ui + Next.js App Router specifics (not generic)
- Supervisor vs Agent role differentiation in UI

---

## Monorepo restructure — COMPLETED (2026-06-19)

Updated project structure:
```
provana-plugins/
├── core/       ← git-workflow, api-design, bash guard
├── design/     ← ui-ux, design-system, ui-styling
├── proctl/     ← CLI tool
└── scratchpad/ ← spec files
```

---

## proctl published to GitHub Packages — COMPLETED (2026-06-19)

**Package:** `@109628/proctl@0.1.0`
**Registry:** https://npm.pkg.github.com
**Access:** restricted (proprietary)

### What was required to publish
- `package.json` scoped name: `@109628/proctl`
- `publishConfig.registry`: `https://npm.pkg.github.com`
- `publishConfig.access`: `"restricted"`
- `proctl/.npmrc`: `@109628:registry=https://npm.pkg.github.com`
- GitHub PAT with `write:packages` + `repo` scopes
- `npm login --registry=https://npm.pkg.github.com --scope=@109628`
- `npm publish` from inside `proctl/` directory

### Team onboarding (new member setup)

1. Generate GitHub PAT → github.com/settings/tokens
   - Scope: `read:packages` only
2. Add to `~/.npmrc`:
   ```
   @109628:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=THEIR_PAT
   ```
3. Install:
   ```bash
   npm install -g @109628/proctl
   proctl --version
   ```

### Future releases (publisher)
```bash
npm version patch   # or minor / major
npm publish
git push
```

### Team updates
```bash
npm install -g @109628/proctl@latest
```

### Auth summary
| Role | PAT scopes needed |
|---|---|
| Publisher (Yethu) | `write:packages` + `repo` |
| Installer (team) | `read:packages` only |

---

## Sprint 2+ — PENDING

User has not yet chosen priority. Options:

### Option A: More plugins (parallel agents, fast)
Spin up parallel `team-plugin-*` agents, each building one plugin:

| Plugin | Skills | MCP | Hooks |
|---|---|---|---|
| `provana-branching` | branching-conventions | — | branch-name-guard.ps1 |
| `provana-postgres` | schema-design, query-patterns | postgres-helper (stdio) | migration-check.ps1 |
| `provana-nextjs` | nextjs-patterns, component-design | — | eslint-on-edit.ps1 |
| `provana-express` | express-patterns, api-security | — | eslint-on-edit.ps1 |
| `provana-fastapi` | fastapi-patterns, docker-setup | langfuse (url) | ruff-lint.ps1 |
| `provana-testing` | unit-testing, test-strategy | — | run-tests-on-push.ps1 |
| `provana-compliance` | regulatory-standards, owasp | — | compliance-check.ps1, dep-vuln-scan.ps1 |
| `provana-deploy` | aca-deploy, azure-devops-push | — | deploy-safety-guard.ps1 |
| `provana-databricks` | databricks-cdc, delta-lake | databricks-api (url) | — |
| `provana-livekit` | livekit-agent-patterns | — | audio-file-guard.ps1 |

Full details in `provana-ecosystem.md`.

### Option B: Registry backend (FastAPI + PostgreSQL)
REST API for plugin metadata + download tracking. Enables Admin UI.
See plan file for full spec.

### Option C: Admin UI (Next.js)
Admin-only web app. Manage plugins, view download analytics.
Requires registry backend first.

---

## Planned plugin install order (for new Provana projects)

1. `provana-core` — always first
2. `provana-branching` — before any coding
3. Domain plugin (postgres / nextjs / express / fastapi / databricks)
4. `provana-testing` — after domain plugin
5. `provana-compliance` — all customer-facing or data-handling projects
6. `provana-deploy` — when ready to ship

---

## Key decisions log

| Decision | Choice | Reason |
|---|---|---|
| CLI name | `proctl` | Provana-branded, follows kubectl/plugctl pattern |
| State location | `~/.claude/proctl/` | Co-located with agent config it manages |
| Tag key | `__proctl` | Unique, scannable, no collision with user keys |
| Agent scope | Claude Code + Copilot | Cursor not used at Provana |
| Hook format | PowerShell `.ps1` | Provana runs Windows, existing hooks are .ps1 |
| Hook safety | Append-only | User's existing 5+ hooks must survive plugin installs |
| Backup strategy | `.proctl-bak-<ISO>` | Matches claudoo backup pattern already on system |
| Plugin repos | Public GitHub, user 109628 | Simplest start; move to org later |
| Copilot scope | Project-only | Copilot has no global skills dir |
| Standalone installs | `proctl skill/mcp/hook add` | Avoid requiring plugin.json for simple one-offs |
| Registry config | `registries.json` | Named aliases for shorthand `proctl add provana/core` |

---

## Files a new agent should read (in order)

1. `scratchpad/conversation.md` ← THIS FILE (start here)
2. `scratchpad/SKILL.md` ← full build spec for proctl
3. `scratchpad/architecture.md` ← module APIs
4. `scratchpad/agent-targets.md` ← settings.json formats (exact)
5. `scratchpad/cli-spec.md` ← all CLI commands
6. `scratchpad/provana-ecosystem.md` ← plugin catalogue
7. Plan file: `~/.claude/plans/please-plan-for-the-spicy-wreath.md` ← overall plan
