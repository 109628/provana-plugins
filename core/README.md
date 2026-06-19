# provana-core

Core skills and safety hooks for Provana engineering — works with Claude Code and GitHub Copilot.

## What's included

| Component | Type | Description |
|-----------|------|-------------|
| `git-workflow` | Skill | Conventional commits, branch naming, PR descriptions |
| `api-design` | Skill | REST design, OpenAPI, error schemas, versioning |
| `dangerous-bash-guard` | Hook | Blocks destructive shell commands before execution |

## Install

```bash
proctl add 109628/provana-core --all -a claude -y
```

This installs all skills and registers the safety hook in Claude Code's `settings.json`.

## Install options

```bash
# Skills only (no hook)
proctl add 109628/provana-core --skills -a claude -y

# Specific skill only
proctl add 109628/provana-core --skill git-workflow -a claude -y
```

## Remove

```bash
proctl remove provana-core -y
```

## Skills

### git-workflow

Guides conventional commit messages, Provana branch naming (`type/TICKET-short-desc`),
and PR description templates. Invoke with `/git-workflow` in Claude Code.

### api-design

Covers REST resource naming, HTTP method semantics, status codes, the Provana error
envelope (`{ error: { code, message, details }, requestId }`), and OpenAPI 3.1 structure.
Invoke with `/api-design` in Claude Code.

## Hook: dangerous-bash-guard

A `PreToolUse` hook that intercepts Bash calls and blocks commands matching dangerous
patterns before Claude executes them:

- `rm -rf` / `rm -r`
- `git reset --hard`
- `git clean -f`
- `DROP TABLE` / `DROP DATABASE`
- `format c:` / `del /s`
- `kubectl delete` without `--namespace`

When a command is blocked, Claude receives an explanation and is prompted to confirm
the action with you before retrying.

## Requirements

- [proctl](https://github.com/109628/provana-plugins) — Provana plugin manager
- Claude Code CLI

## License

MIT
