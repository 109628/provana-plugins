# Manifest Schema Reference

## plugin.json

```json
{
  "name": "string, required — lowercase [a-z0-9-], max 64 chars",
  "version": "string, required — semver (e.g. 1.0.0)",
  "description": "string, required — max 256 chars, one sentence",
  "author": "string, optional — GitHub username or org",
  "license": "string, optional — SPDX identifier (e.g. MIT)",
  "homepage": "string, optional — URL",
  "repository": "string, optional — owner/repo",

  "components": {
    "skills": {
      "<skill-name>": {
        "path": "string, required — relative path to dir containing SKILL.md",
        "description": "string, required — max 1024 chars, triggers agent selection"
      }
    },

    "mcp_servers": {
      "<server-name>": {
        "type": "string, required — 'url' | 'stdio'",
        "url": "string, required if type=url — MCP server SSE/streamable URL",
        "command": "string, required if type=stdio — executable command",
        "args": ["string array, optional — command arguments"],
        "env": { "KEY": "VALUE — optional env vars passed to MCP process" },
        "description": "string, required — what this MCP server provides"
      }
    },

    "hooks": {
      "<hook-name>": {
        "event": "string, required — lifecycle event (see list below)",
        "script": "string, required — relative path to script (.ps1 for Windows hooks)",
        "matcher": "string, optional — regex for PreToolUse/PostToolUse (default: *)",
        "args": ["string array, optional — additional arguments"],
        "async": "boolean, optional, default true",
        "timeout": "number, optional, default 10000 — ms",
        "description": "string, optional"
      }
    },

    "commands": {
      "<command-name>": {
        "path": "string, required — relative path to .md file",
        "description": "string, optional — overrides frontmatter description"
      }
    },

    "statusline": {
      "script": "string, required — relative path to script that writes to stdout",
      "refreshInterval": "number, optional, default 5 — seconds",
      "description": "string, optional"
    }
  },

  "agents": {
    "claude-code": {
      "supported": "boolean, default true",
      "skills_only": "boolean, default false"
    },
    "copilot": {
      "supported": "boolean, default true",
      "skills_only": "boolean, default true — Copilot only supports skills and MCP"
    }
  },

  "files": ["string array, optional — additional dirs to copy (bin, lib, etc.)"]
}
```

## Valid hook events (Claude Code)

- `PreToolUse` — before tool call executes. Use `matcher` to target specific tools.
- `PostToolUse` — after tool call completes. Use `matcher` to target specific tools.
- `UserPromptSubmit` — when user submits a prompt. No matcher needed.
- `Stop` — when agent stops generating.
- `SessionEnd` — when session is torn down.
- `Notification` — when agent emits a notification.

## Multi-plugin repos

For repos containing multiple plugins:

```
repo-root/
├── provana-core/
│   ├── plugin.json
│   ├── skills/
│   └── hooks/
├── provana-branching/
│   ├── plugin.json
│   └── skills/
└── README.md
```

Registry resolver:
1. Check for `plugin.json` at repo root (single-plugin repo)
2. If not found, list top-level dirs, check each for `plugin.json`
3. Return list for user selection

## Validation rules

1. `name` required, matches `/^[a-z][a-z0-9-]*$/`, max 64 chars
2. `version` required, valid semver
3. `description` required, max 256 chars
4. At least one component type must exist in `components`
5. Every skill entry has `path` pointing to a dir containing `SKILL.md`
6. Every MCP entry has either `url` (type=url) or `command` (type=stdio)
7. Every hook entry has valid `event` from the known events list
8. Every hook entry has `script` pointing to a file (validated at install time, not schema time)
9. Every command entry has `path` pointing to a `.md` file
10. `agents` keys must be from: `claude-code`, `copilot`
11. No duplicate names across component types (skill and hook can't share a name)
12. `{{pluginDir}}` is the only allowed template variable in command/script strings

Return ALL validation errors at once — never stop at first.

## `__proctl` tag

proctl adds `"__proctl": "<plugin-name>"` to every entry it writes into agent settings files.
This tag is how proctl identifies its own entries for idempotent reinstalls and clean removal.
The tag is NOT part of the plugin.json schema — it's added by proctl at install time.
