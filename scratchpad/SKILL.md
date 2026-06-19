---
name: build-proctl
description: >
  Build proctl, Provana's plugin manager CLI for AI coding agents. Plugins bundle
  skills (SKILL.md), MCP servers, lifecycle hooks, slash commands, and statusline scripts.
  Users can install full plugins or cherry-pick individual components, targeting Claude Code
  or GitHub Copilot. The CLI fetches plugins from GitHub repos or local directories,
  reads a plugin.json manifest, and routes each component to the correct agent config.
  Also supports standalone installs: proctl skill add, proctl mcp add, proctl hook add.
  Use when building, extending, or debugging the proctl CLI, adding agent adapters,
  or implementing component installers.
---

# proctl — Provana Plugin Manager for AI Coding Agents

## What you are building

A Node.js CLI tool called `proctl` that manages **plugins** for AI coding agents.
A plugin is a GitHub repo (or local directory) containing a `plugin.json` manifest and
one or more **components**: skills, MCP servers, hooks, commands, statusline scripts.

Target agents: **Claude Code and GitHub Copilot only**. Cursor is out of scope.

Three key design principles:

1. **Granular install** — users can install the full plugin OR cherry-pick specific
   components (a single skill, a single MCP server, a single hook)
2. **Agent-aware routing** — each component installs to the correct location depending
   on which agent is targeted (Claude Code vs GitHub Copilot)
3. **Safe merge** — proctl only touches entries it owns (tagged `__proctl`). Existing
   user config is never overwritten or deleted

## Architecture overview

```
proctl CLI (bin/proctl.cmd + bin/proctl.js)
│
├── lib/registry.js        — Resolve source (GitHub, local) → fetch manifest + files
├── lib/manifest.js        — Parse plugin.json, validate, filter components
├── lib/installer.js       — Orchestrator: manifest + user selections → component installers
│
├── lib/components/        — One installer per component type
│   ├── skills.js          — Copy SKILL.md dirs to agent skills folder
│   ├── mcp.js             — Merge MCP server entries into agent settings
│   ├── hooks.js           — Append lifecycle hooks (safe merge, __proctl tag)
│   ├── commands.js        — Copy slash-command .md files
│   └── statusline.js      — Set statusLine in agent settings
│
├── lib/agents/            — One adapter per agent (Claude Code and Copilot only)
│   ├── claude-code.js     — Knows ~/.claude/ paths, settings.json format, all capabilities
│   └── copilot.js         — Knows .github/ structure, .vscode/mcp.json format (skills + MCP only)
│
├── lib/settings.js        — Safe JSON read/write/backup for settings files
├── lib/state.js           — Track installed plugins in ~/.claude/proctl/state.json
└── lib/ui.js              — Interactive prompts (inquirer-based checkbox selection)
```

Read `architecture.md` for the full module-by-module spec, data flow, and error handling.

## CLI commands

```
proctl add <source>                                    # interactive: pick plugin + components + agent
proctl add <source> --plugin <name>                    # install full plugin
proctl add <source> --plugin <name> --skill <name>     # just one skill from plugin
proctl add <source> --plugin <name> --mcp <name>       # just one MCP server from plugin
proctl add <source> --plugin <name> --hook <name>      # just one hook from plugin
proctl add <source> --only skills,mcp                  # only these component types
proctl add <source> -a claude -y                       # non-interactive, claude code target
proctl add <source> -a copilot                         # target copilot only
proctl remove <plugin>                                 # remove full plugin
proctl remove <plugin> --skill <name>                  # remove specific component
proctl list                                            # show installed plugins + components
proctl list --available <source>                       # browse remote source
proctl update <plugin>                                 # fetch latest + reinstall
proctl init <name>                                     # scaffold new plugin repo

# Standalone installs (no plugin.json needed)
proctl skill add <url-or-path>                         # install bare SKILL.md directly
proctl mcp add <name> <command-or-url> [--env K=V]    # install one MCP entry
proctl hook add <event> <script-path>                  # install one hook
proctl registry add <alias> <url> [--token <token>]   # register named registry
```

Where `<source>` is:
- `owner/repo` — GitHub shorthand
- `alias/plugin-name` — named registry (see `proctl registry add`)
- `https://github.com/owner/repo` — full URL
- `./path/to/local/dir` — local directory

Read `cli-spec.md` for the full argument matrix, flags, and exit codes.

## Plugin manifest

Every plugin repo has a `plugin.json` at root. Quick example:

```json
{
  "name": "provana-core",
  "version": "1.0.0",
  "description": "Provana core skills and safety hooks for all engineering projects",
  "author": "109628",
  "components": {
    "skills": {
      "git-workflow": {
        "path": "skills/git-workflow",
        "description": "Conventional commits, PR descriptions, branch naming"
      },
      "api-design": {
        "path": "skills/api-design",
        "description": "REST API design, OpenAPI spec, error schemas"
      }
    },
    "hooks": {
      "dangerous-bash-guard": {
        "event": "PreToolUse",
        "script": "hooks/dangerous-bash-guard.ps1",
        "description": "Block destructive shell commands before execution",
        "async": false
      }
    }
  },
  "agents": {
    "claude-code": { "supported": true },
    "copilot": { "supported": true, "skills_only": true }
  }
}
```

Read `manifest-schema.md` for the full JSON schema and validation rules.

## Agent adapter contract

Each agent adapter exports:

```js
module.exports = {
  name: 'claude-code',          // or 'copilot'
  detect()                      // → bool: is this agent installed/detected?
  capabilities()                // → { skills, mcp, hooks, commands, statusline }
  installSkill(name, files, opts)
  installMcp(name, config, opts)
  installHook(event, config, opts)
  installCommand(name, content, opts)
  installStatusline(config, opts)
  removeSkill(name)
  removeMcp(name)
  removeHook(pluginName)
  removeCommand(name)
  removeStatusline(pluginName)
  getSettingsPath()             // → absolute path to settings file
  getSkillsDir(scope)           // → path, scope = 'global' | 'project'
}
```

Read `agent-targets.md` for config locations, settings format, and capabilities per agent.

## Build sequence

Implement in this order:

1. **Scaffold npm package** — `package.json` with `bin.proctl` field, directory structure
2. **bin/proctl.cmd** — Windows wrapper: `@node "%~dp0\proctl.js" %*`
3. **lib/settings.js** — JSON read/write/backup (all other modules depend on this)
4. **lib/state.js** — state.json tracker at `~/.claude/proctl/state.json`
5. **lib/manifest.js** — plugin.json parser + validator
6. **lib/registry.js** — GitHub raw content fetcher + local resolver + named registry support
7. **lib/agents/claude-code.js** — first adapter (supports all 5 component types)
8. **lib/agents/copilot.js** — second adapter (skills + MCP only)
9. **lib/components/*.js** — skills, mcp, hooks, commands, statusline installers
10. **lib/installer.js** — orchestrator wiring manifest → installers → adapters
11. **bin/proctl.js** — CLI entry point with Commander.js argument parsing
12. **lib/ui.js** — interactive selection (inquirer)
13. **Standalone subcommands** — `proctl skill add`, `proctl mcp add`, `proctl hook add`
14. **proctl init** — scaffolder

## Critical implementation rules

- **Windows paths always via os.homedir().** Use `path.join(os.homedir(), '.claude', ...)`
  never hardcoded `/home/user` or `~` expansion. The tool runs on Windows.
- **Hook scripts are PowerShell (.ps1) on Windows.** When installing hooks, copy `.ps1`
  files to `~/.claude/proctl/plugins/<plugin>/hooks/`. Register as:
  `{ "type": "command", "command": "powershell -File \"<path>\"" }`
  The Claude Code settings.json hooks format requires `matcher` (tool name pattern) for
  PreToolUse/PostToolUse. Read the real settings.json format in `agent-targets.md`.
- **Always backup settings before writing.** Copy to `<file>.proctl-bak-<ISO-timestamp>`.
- **Tag all managed entries with `__proctl`.** Every hook/MCP/statusline entry written to
  settings must carry `"__proctl": "<plugin-name>"`. This is how remove works without
  brittle path matching.
- **Idempotent installs.** Running `add` twice must not duplicate entries. Before
  installing, remove any existing `__proctl: plugin-name` entries for that plugin.
- **Append-only for hooks.** Never remove entries without `__proctl` tag. The user's
  existing hooks (dangerous-bash-guard.ps1, lint-on-edit.ps1, etc.) must survive.
- **Copilot: skills are project-scoped only.** No global skills dir for Copilot.
  Write to `.github/copilot/skills/<name>/SKILL.md` relative to cwd.
- **State file location:** `~/.claude/proctl/state.json` (not `~/.proctl/` — keep all
  proctl data inside `.claude/` to stay co-located with the agent config it manages).
- **`{{pluginDir}}` template variable.** Replace with the absolute installed path of the
  plugin runtime dir (`~/.claude/proctl/plugins/<plugin-name>/`) at install time.
- **Fail gracefully on unsupported components.** If statusline/hooks requested for Copilot,
  warn with yellow text and skip — never abort the entire install.

## Reference files

Read these before implementing each module:

- `architecture.md` — Module responsibilities, data flow, class APIs, error handling
- `manifest-schema.md` — Complete plugin.json schema + validation rules
- `agent-targets.md` — Config locations, settings formats, capability matrix per agent
- `cli-spec.md` — Full CLI argument spec, flags, standalone subcommands, exit codes
- `plugin.json` — Starter manifest template (for `proctl init`)
- `provana-ecosystem.md` — Catalogue of Provana plugins this tool will serve (context only)
