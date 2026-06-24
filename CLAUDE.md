# provana-plugins — Project Intelligence

## What this repo is

Provana's plugin registry + CLI for AI coding agents (Claude Code + GitHub Copilot).
Two things live here:
1. `proctl/` — the CLI tool that installs plugins
2. Plugin folders (`core/`, `design/`, `ado/`, `quality/`, `data/`) — the actual plugins

GitHub: https://github.com/109628/provana-plugins
npm: `@109628/proctl` on GitHub Packages (private — Provana internal only)

---

## Repo structure

```
provana-plugins/
├── proctl/              ← CLI tool (Node.js, published to GitHub Packages as @109628/proctl)
│   ├── bin/proctl.js    ← Commander.js entry point
│   ├── lib/
│   │   ├── registry.js  ← GitHub raw fetcher + local resolver + named registry
│   │   │                   IMPORTANT: resolve(source, {plugin}) for subfolder lookup
│   │   │                   Bare name (e.g. "core") auto-resolves to 109628/provana-plugins
│   │   ├── installer.js ← orchestrator — passes pluginFilter to registry.resolve
│   │   ├── manifest.js  ← plugin.json parser + validator
│   │   ├── settings.js  ← atomic JSON read/write/backup for settings files
│   │   ├── state.js     ← ~/.claude/proctl/state.json tracker
│   │   ├── ui.js        ← inquirer interactive prompts
│   │   ├── agents/
│   │   │   ├── claude-code.js  ← full adapter (skills/MCP/hooks/commands/statusline)
│   │   │   ├── copilot.js      ← skills + MCP only
│   │   │   └── index.js        ← 'claude' → 'claude-code' alias
│   │   └── components/
│   │       ├── skills.js / mcp.js / hooks.js / commands.js / statusline.js
│   ├── package.json     ← name: @109628/proctl, publishConfig → GitHub Packages
│   └── .npmrc           ← @109628:registry=https://npm.pkg.github.com
│
├── core/                ← provana-core plugin v1.1.0
│   ├── plugin.json
│   ├── skills/git-workflow/SKILL.md
│   ├── skills/api-design/SKILL.md
│   ├── commands/provana.md   ← /provana command (plugin catalogue)
│   └── hooks/dangerous-bash-guard.ps1
│
├── design/              ← provana-design plugin v1.0.0
│   ├── plugin.json
│   ├── skills/ui-ux/SKILL.md
│   ├── skills/design-system/SKILL.md
│   └── skills/ui-styling/SKILL.md
│
├── ado/                 ← provana-ado plugin v1.1.0
│   ├── plugin.json      ← MCP: azure_devops (domains: core/repos/work-items/pipelines)
│   ├── skills/ado-work-items/SKILL.md
│   └── skills/ado-repositories/SKILL.md
│
├── quality/             ← provana-quality plugin v1.0.0
│   ├── plugin.json
│   ├── skills/code-review/SKILL.md
│   ├── skills/test-coverage/SKILL.md
│   └── hooks/pre-commit-quality-gate.ps1
│
├── data/                ← provana-data plugin v1.0.0
│   ├── plugin.json      ← MCP: databricks (databricks mcp start)
│   ├── skills/databricks-patterns/SKILL.md
│   ├── skills/cdc-patterns/SKILL.md
│   ├── skills/data-quality/SKILL.md
│   └── skills/sql-analytics/SKILL.md
│
└── scratchpad/          ← spec files for contributors (not a plugin)
    ├── SKILL.md         ← build spec for proctl CLI
    ├── architecture.md  ← module-by-module API specs
    ├── agent-targets.md ← Claude Code + Copilot config formats (exact)
    ├── cli-spec.md      ← full CLI argument spec
    ├── manifest-schema.md
    ├── provana-ecosystem.md  ← full planned plugin catalogue
    └── conversation.md  ← full project history + decisions log (READ THIS)
```

---

## Plugin format

Every plugin is a subfolder with `plugin.json` at its root:

```json
{
  "name": "provana-xxx",
  "version": "1.0.0",
  "description": "...",
  "components": {
    "skills": { "<name>": { "path": "skills/<name>", "description": "..." } },
    "mcp_servers": { "<name>": { "type": "stdio|url", "command": "...", "args": [] } },
    "hooks": { "<name>": { "event": "PreToolUse", "script": "hooks/x.ps1", "matcher": "Bash" } },
    "commands": { "<name>": { "path": "commands/<name>.md" } }
  },
  "agents": {
    "claude-code": { "supported": true },
    "copilot": { "supported": true, "skills_only": true }
  }
}
```

Hooks are `.ps1` (PowerShell — Windows). Registered as `powershell -File "<abs-path>"`.

---

## Critical rules (never break)

1. **Windows paths** — all via `path.join(os.homedir(), '.claude', ...)`, never `~` or hardcoded
2. **`__proctl` tag** — every entry proctl writes to settings.json carries this tag for safe removal
3. **Append-only hooks** — never remove hook entries without `__proctl` tag
4. **Backup before write** — `settings.json.proctl-bak-<ISOtimestamp>` before every change
5. **Idempotent** — double install = no duplicates
6. **State file** — `~/.claude/proctl/state.json` (NOT `~/.proctl/`)
7. **Copilot scope** — project-only, writes to `.github/copilot/skills/` + `.vscode/mcp.json`
8. **Subfolder install** — `registry.resolve(source, {plugin})` looks for `<plugin>/plugin.json`

---

## proctl CLI commands

```bash
# Short form (default registry = 109628/provana-plugins)
proctl add core                                           # full plugin
proctl add core --only skills                             # skills only
proctl add core -a copilot                                # copilot target

# Explicit form (other repos or overrides)
proctl add 109628/provana-plugins --plugin core           # same as above, explicit
proctl list                                               # installed plugins
proctl list --available 109628/provana-plugins            # browse registry
proctl remove provana-core                                # remove plugin
proctl update provana-core                                # update plugin
proctl skill add <url/path>                               # standalone skill
proctl mcp add <name> <url>                               # standalone MCP
proctl hook add <event> <script>                          # standalone hook
proctl registry add <alias> <url>                         # named registry
proctl init <name>                                        # scaffold new plugin
```

---

## Installed plugins (current)

| Plugin | Folder | Version | Skills | MCP | Hooks | Agents |
|---|---|---|---|---|---|---|
| provana-core | `core/` | 1.1.0 | git-workflow, api-design | — | dangerous-bash-guard | Both |
| provana-design | `design/` | 1.0.0 | ui-ux, design-system, ui-styling | — | — | Both |
| provana-ado | `ado/` | 1.1.0 | ado-work-items, ado-repositories | azure_devops | — | Both |
| provana-quality | `quality/` | 1.0.0 | code-review, test-coverage | — | pre-commit-quality-gate | Claude only for hooks |
| provana-data | `data/` | 1.0.0 | databricks-patterns, cdc-patterns, data-quality, sql-analytics | databricks | — | Both |
| provana-langfuse | `langfuse/` | 1.0.0 | provana-langfuse-prompts | — | — | Both |
| provana-superpowers | `superpowers/` | 1.7.0 | 26 skills: TDD, Azure design, QA automation, SRE runbooks, parallel orchestration, voice/doc scaffolds | — | — | Claude only |

---

## npm publishing (proctl CLI only)

Plugins don't need publishing — fetched from GitHub raw at install time.
Only publish when `proctl/` code changes:

```bash
cd proctl
npm version patch   # or minor/major
npm publish         # → GitHub Packages @109628/proctl
git push
```

Team installs via:
```bash
# ~/.npmrc must have:
# @109628:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=<PAT with read:packages>

npm install -g @109628/proctl@latest
```

---

## Private repo note

If repo goes private: team needs `PROCTL_GITHUB_TOKEN` env var with `repo` scope.
proctl already supports it — reads `process.env.PROCTL_GITHUB_TOKEN` in registry.js.

---

## Adding a new plugin

1. Create subfolder: `mkdir <name>/skills/<skill-name>`
2. Write `<name>/plugin.json` (see format above)
3. Write `<name>/skills/<skill-name>/SKILL.md`
4. Write hooks if needed (`<name>/hooks/<name>.ps1`)
5. `git add <name>/ && git commit && git push`
6. Update `core/commands/provana.md` table with new plugin
7. Test: `proctl add <name> -a claude -y`

No publish step needed for plugins.

---

## Context files to read

Full history, all decisions, what's next:
- `scratchpad/conversation.md` — complete project log (start here for context)
- `scratchpad/architecture.md` — proctl module APIs
- `scratchpad/agent-targets.md` — exact settings.json formats for Claude Code + Copilot
- `scratchpad/provana-ecosystem.md` — planned future plugins
