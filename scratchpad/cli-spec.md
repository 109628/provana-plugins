# CLI Specification

## Global flags

| Flag        | Short | Description                                |
|-------------|-------|--------------------------------------------|
| `--verbose` | `-v`  | Print debug output including HTTP requests  |
| `--dry-run` |       | Show what would happen, don't write files   |
| `--yes`     | `-y`  | Skip all confirmation prompts               |
| `--help`    | `-h`  | Show help for command                       |
| `--version` |       | Print proctl version                        |

## Commands

### `proctl add <source>`

Install a plugin or specific components.

| Flag                | Short | Description                                          |
|---------------------|-------|------------------------------------------------------|
| `<source>`          |       | `owner/repo`, `alias/name`, full URL, or local path  |
| `--plugin <name>`   | `-p`  | Install specific plugin (for multi-plugin repos)     |
| `--skill <name>`    | `-s`  | Install only this skill (repeatable)                 |
| `--mcp <name>`      | `-m`  | Install only this MCP server (repeatable)            |
| `--hook <name>`     |       | Install only this hook (repeatable)                  |
| `--command <name>`  |       | Install only this command (repeatable)               |
| `--statusline`      |       | Install only the statusline                          |
| `--only <types>`    |       | Comma-separated component types: `skills,mcp,hooks`  |
| `--all`             |       | Install all components (skip component picker)       |
| `--agent <name>`    | `-a`  | Target agent (repeatable). Values: `claude`, `copilot` |
| `--global`          | `-g`  | Install to global scope (Claude Code only)           |

**Interactive flow**:

```
$ proctl add 109628/provana-core

  Fetching plugin from 109628/provana-core...

  provana-core v1.0.0 — Provana core skills and safety hooks

  ◆ Which components do you want to install?
  │ ── Skills ──
  │ ● git-workflow — Conventional commits, PR descriptions, branch naming
  │ ● api-design — REST API design, OpenAPI spec, error schemas
  │ ── Hooks ──
  │ ● dangerous-bash-guard — Block destructive shell commands
  └ [space to toggle, enter to confirm]

  ◆ Which agents do you want to install to?
  │ ● Claude Code (detected)
  │ ○ GitHub Copilot (not detected in this project)
  └ [space to toggle, enter to confirm]

  ⚠ GitHub Copilot doesn't support: hooks
    hooks will be skipped for Copilot.

  Will install to Claude Code:
    Skills: git-workflow, api-design
    Hooks: dangerous-bash-guard (PreToolUse, matcher: "Bash")

  ◆ Proceed? (Y/n)

  ✓ Installed provana-core v1.0.0 to Claude Code
    Settings backed up: %USERPROFILE%\.claude\settings.json.proctl-bak-2026-06-18T...
    Restart Claude Code to activate hooks and MCP servers.
```

**Non-interactive**:

```
$ proctl add 109628/provana-core --only skills -a claude -y
✓ Installed 2 skills from provana-core to Claude Code
```

---

### `proctl remove <plugin>`

| Flag                | Description                               |
|---------------------|-------------------------------------------|
| `<plugin>`          | Plugin name from `proctl list`            |
| `--skill <name>`    | Remove only this skill (repeatable)       |
| `--mcp <name>`      | Remove only this MCP server              |
| `--hook <name>`     | Remove only this hook                    |
| `--command <name>`  | Remove only this command                 |
| `--statusline`      | Remove only the statusline               |
| `--agent <name>`    | Remove from specific agent only          |
| `--all`             | Remove all components without prompt     |

No component flags = removes everything. Partial flags = removes only those.

---

### `proctl list`

| Flag                | Description                                    |
|---------------------|------------------------------------------------|
| `--available <src>` | List plugins available at a remote source      |
| `--json`            | Output as JSON                                 |
| `--components`      | Show component details per plugin              |

```
$ proctl list

  Installed plugins:

  provana-core v1.0.0  (from 109628/provana-core)
    Claude Code: skills(2) hooks(1)

  provana-fastapi v0.3.0  (from 109628/provana-fastapi)
    Claude Code: skills(2) mcp(2) hooks(1)
    Copilot:     skills(2) mcp(2)
```

---

### `proctl update <plugin>`

| Flag      | Description                          |
|-----------|--------------------------------------|
| `--check` | Check for updates without installing |

---

### `proctl init <name>`

Scaffold a new plugin repository in the current directory.

| Flag               | Description                                         |
|--------------------|-----------------------------------------------------|
| `--from-claude`    | Auto-populate from existing `~/.claude/` directory  |
| `--name <name>`    | Plugin name (prompted if not given)                 |

Creates:

```
<name>/
├── plugin.json        (from template with name filled in)
├── README.md
├── skills/
│   └── example-skill/
│       └── SKILL.md
├── hooks/
├── commands/
└── conversation.md    (decisions log — fill in as you build)
```

---

### `proctl skill add <source>`

Standalone skill install. No `plugin.json` needed.

`<source>` can be:
- URL to a raw `SKILL.md` file
- URL to a GitHub directory containing `SKILL.md`
- Local path to a directory containing `SKILL.md`

```
$ proctl skill add https://raw.githubusercontent.com/109628/my-skills/main/nextjs/SKILL.md
✓ Installed skill nextjs to Claude Code
```

Internally creates an implicit state entry `__standalone__skill__nextjs` for tracking/removal.
Remove with: `proctl skill remove nextjs`

---

### `proctl mcp add <name> <command-or-url>`

Standalone MCP server install. No `plugin.json` needed.

```
$ proctl mcp add langfuse https://langfuse-aiml.provana.com/api/public/mcp
$ proctl mcp add postgres-helper node --arg "C:\tools\pg-mcp\server.js" --env DATABASE_URL=postgres://...
```

| Flag            | Description                              |
|-----------------|------------------------------------------|
| `--env KEY=VAL` | Environment variable (repeatable)        |
| `--agent <name>`| Target agent (default: claude)           |

---

### `proctl hook add <event> <script-path>`

Standalone hook install.

```
$ proctl hook add PreToolUse C:\tools\my-safety-check.ps1 --matcher "Bash"
$ proctl hook add UserPromptSubmit C:\tools\compliance.ps1
```

| Flag              | Description                                    |
|-------------------|------------------------------------------------|
| `--matcher <pat>` | Regex for PreToolUse/PostToolUse (default: `*`) |
| `--async`         | Run async (default: true)                      |

---

### `proctl registry add <alias> <url>`

Register a named registry for shorthand source resolution.

```
$ proctl registry add provana https://github.com/109628 --token ghp_...
```

After registration: `proctl add provana/core` resolves to `https://github.com/109628/provana-core`

Config stored at: `%USERPROFILE%\.claude\proctl\registries.json`

---

## Exit codes

| Code | Meaning                     |
|------|-----------------------------|
| 0    | Success                     |
| 1    | General error               |
| 2    | Invalid arguments           |
| 3    | Source/plugin not found     |
| 4    | Manifest validation failed  |
| 5    | Install/remove failed       |
| 6    | Agent not detected          |

## Environment variables

| Variable               | Description                                      |
|------------------------|--------------------------------------------------|
| `PROCTL_HOME`          | Override `~/.claude/proctl/` directory           |
| `PROCTL_GITHUB_TOKEN`  | GitHub PAT for private repos                     |
| `NO_COLOR`             | Disable colored output                           |
