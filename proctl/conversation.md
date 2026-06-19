# proctl CLI — Decisions Log

Read `../scratchpad/conversation.md` first for full project context.
This file covers CLI-specific decisions only.

---

## Status: COMPLETE (Sprint 1, 2026-06-18)

Built, installed globally via `npm install -g .`, all tests passing.

## Key implementation decisions

**Commander.js for arg parsing** — not hand-rolled. Simpler, handles flag repetition
(`-a claude -a copilot`), built-in `--help` generation.

**inquirer v9** — ESM package. If you see import errors, check that `package.json`
has `"type": "module"` OR use dynamic import. Current impl uses dynamic import wrapper.

**Atomic write in settings.js** — writes to `<file>.tmp` then `fs.renameSync`.
Prevents corrupt settings.json if process killed mid-write.

**`claude` as alias for `claude-code`** — `lib/agents/index.js` normalizes `claude` →
`claude-code` so users don't have to type the full name in `-a` flag.

**State inside `.claude/`** — `~/.claude/proctl/state.json`. Rejected `~/.proctl/`
because it creates an orphaned directory after uninstall. Keeping inside `.claude/`
means `rm -rf ~/.claude/proctl` cleans everything.

**Plugin runtime dir** — `~/.claude/proctl/plugins/<plugin-name>/` stores hook scripts
and bin scripts. The `{{pluginDir}}` template var resolves to this absolute path at
install time.

**`proctl hook remove` gap** — standalone hooks tracked as `__standalone__hook__<name>`
in state.json. A dedicated `proctl hook remove <name>` subcommand not yet implemented.
Workaround: `proctl remove __standalone__hook__<name> -y`. Add in next CLI iteration.

## Commands and what they produce

| Command | What changes |
|---|---|
| `proctl add <src> --all -a claude -y` | skills → `~/.claude/skills/`, hooks → `settings.json` + scripts copied to plugin dir, state.json updated |
| `proctl remove <plugin>` | Reverses above, `__proctl`-tagged entries only |
| `proctl skill add <path>` | `~/.claude/skills/<name>/SKILL.md`, state entry `__standalone__skill__<name>` |
| `proctl mcp add <name> <url>` | `settings.json` mcpServers entry with `__proctl: "__standalone__mcp__<name>"` |
| `proctl hook add <event> <script>` | `settings.json` hooks entry with `__proctl: "__standalone__hook__<name>"` |
| `proctl registry add <alias> <url>` | `~/.claude/proctl/registries.json` entry |

## What to improve next (follow-up tasks)

- `proctl hook remove <name>` shortcut
- `proctl update --all` (update all installed plugins)
- `PROCTL_REGISTRY_URL` env var to point at Phase 2 registry backend
- `proctl add --from-registry` to browse the registry backend
- Version pinning: `proctl add 109628/provana-core@1.0.0`
