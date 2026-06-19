# Agent Targets Reference

**Scope: Claude Code and GitHub Copilot only.** Cursor is out of scope.

## Capability matrix

| Component    | Claude Code | GitHub Copilot |
|-------------|-------------|----------------|
| Skills      | ✅ global or project | ✅ project-only |
| MCP servers | ✅ settings.json | ✅ .vscode/mcp.json |
| Hooks       | ✅ full | ❌ unsupported |
| Commands    | ✅ full | ❌ unsupported |
| StatusLine  | ✅ full | ❌ unsupported |

When a component type is unsupported: warn in yellow, skip — never fail the install.

---

## Claude Code

### Detection

`path.join(os.homedir(), '.claude')` directory exists, OR `claude` command is on PATH.

### Config paths (Windows)

| Item           | Global (user-wide)                                         | Project-local           |
|----------------|-----------------------------------------------------------|-------------------------|
| Settings       | `%USERPROFILE%\.claude\settings.json`                     | `.claude\settings.json` |
| Skills         | `%USERPROFILE%\.claude\skills\<name>\`                    | `.claude\skills\<name>\`|
| Commands       | `%USERPROFILE%\.claude\commands\<name>.md`                | `.claude\commands\<name>.md` |
| Plugin runtime | `%USERPROFILE%\.claude\proctl\plugins\<plugin>\`          | — |
| State          | `%USERPROFILE%\.claude\proctl\state.json`                 | — |

In code: always `path.join(os.homedir(), '.claude', ...)` — never hardcoded paths.

### settings.json format

Claude Code settings.json is a JSON object. proctl writes to these keys:

#### MCP servers (`mcpServers`)

```json
{
  "mcpServers": {
    "langfuse": {
      "type": "url",
      "url": "https://langfuse-aiml.provana.com/api/public/mcp",
      "__proctl": "provana-fastapi"
    },
    "postgres-helper": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\Users\\user\\.claude\\proctl\\plugins\\provana-postgres\\mcp\\server.js"],
      "env": { "DATABASE_URL": "${DATABASE_URL}" },
      "__proctl": "provana-postgres"
    }
  }
}
```

#### Hooks (`hooks`)

Claude Code hooks format (REAL format — match exactly):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File \"C:\\Users\\user\\.claude\\proctl\\plugins\\provana-core\\hooks\\dangerous-bash-guard.ps1\""
          }
        ],
        "__proctl": "provana-core"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File \"C:\\Users\\user\\.claude\\proctl\\plugins\\provana-core\\hooks\\lint-on-edit.ps1\""
          }
        ],
        "__proctl": "provana-core"
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File \"C:\\Users\\user\\.claude\\proctl\\plugins\\provana-compliance\\hooks\\compliance-check.ps1\""
          }
        ],
        "__proctl": "provana-compliance"
      }
    ]
  }
}
```

Notes:
- `matcher` is required for `PreToolUse` and `PostToolUse` — it's a regex matched against tool name
- `UserPromptSubmit`, `Stop`, `SessionEnd`, `Notification` do NOT use `matcher`
- The `__proctl` tag sits on the outer hook group object (not inside the `hooks` array)
- Hook scripts on Windows are PowerShell: `powershell -File "<abs-path>"`

#### StatusLine (`statusLine`)

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:\\Users\\user\\.claude\\proctl\\plugins\\provana-core\\bin\\statusline.js\"",
    "refreshInterval": 5,
    "__proctl": "provana-core"
  }
}
```

### Install operations

**Skills**: `fs.mkdirSync` + `fs.writeFileSync` for each file in skill directory.
Destination: `path.join(os.homedir(), '.claude', 'skills', skillName, 'SKILL.md')`

**MCP**: Read settings.json → set `settings.mcpServers[name] = config` → write back.
Idempotent: overwrite if key already exists.

**Hooks**: Read settings.json → find the event array → remove existing group with
same `__proctl` tag (idempotency) → push new group → write back.
NEVER remove groups without `__proctl` tag.

**Commands**: Write to `path.join(os.homedir(), '.claude', 'commands', name + '.md')`.

**StatusLine**: Set `settings.statusLine = config`. If existing statusLine has no
`__proctl` tag, warn user before overwriting.

### Remove operations

**Skills**: `fs.rmSync(skillDir, { recursive: true })`
**MCP**: Delete key from `mcpServers` where `__proctl === pluginName`
**Hooks**: Filter all event arrays — remove objects where `__proctl === pluginName`.
Then clean up empty arrays and empty `hooks` object.
**Commands**: Delete file if it was installed by proctl (check state tracker, not file content).
**StatusLine**: Delete `statusLine` key if `__proctl === pluginName`.

---

## GitHub Copilot

### Detection

`.github/copilot-instructions.md` exists in cwd, OR `~/.config/github-copilot/` exists.

### Config paths (project-scoped only)

| Item        | Location                                     |
|-------------|----------------------------------------------|
| Skills      | `.github/copilot/skills/<name>/SKILL.md`     |
| MCP servers | `.vscode/mcp.json`                            |
| Instructions append | `.github/copilot-instructions.md`  |

Note: Copilot has no global skills directory. All Copilot installs are project-scoped
relative to the current working directory.

### Skills install

```
.github/copilot/skills/<skill-name>/SKILL.md
```

Copilot discovers skills via directory convention — the SKILL.md frontmatter
(`name` + `description`) fields are read by the agent.

### MCP servers install

Copilot reads MCP from `.vscode/mcp.json`. Format differs from Claude Code:

```json
{
  "servers": {
    "langfuse": {
      "type": "sse",
      "url": "https://langfuse-aiml.provana.com/api/public/mcp",
      "__proctl": "provana-fastapi"
    }
  }
}
```

Note: Copilot uses `type: "sse"` and `"servers"` key; Claude Code uses `type: "url"` and
`"mcpServers"` key. The MCP component installer must translate format based on adapter.

### Instructions append (optional)

For skills that need to inject system-level instructions into Copilot's context,
append to `.github/copilot-instructions.md` with markers:

```markdown
<!-- proctl:provana-core:start -->
Always follow Provana's conventional commit format (feat/fix/refactor/test/docs/chore).
<!-- proctl:provana-core:end -->
```

On remove: strip content between matching markers.

### Unsupported components

Hooks, commands, statusline: not supported. Installer warns and skips.
The `capabilities()` method for the Copilot adapter returns:
`{ skills: true, mcp: true, hooks: false, commands: false, statusline: false }`

---

## Adding a new agent adapter

1. Create `lib/agents/<agent-name>.js`
2. Export the adapter interface (see SKILL.md for the full contract)
3. Register in `lib/agents/index.js`
4. Add to capability matrix above
5. Add to interactive agent picker in `lib/ui.js`

The adapter is the only layer that knows agent-specific paths and formats.
Everything above it is agent-agnostic.
