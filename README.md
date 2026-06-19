# provana-plugins

Provana's plugin registry for AI coding agents (Claude Code + GitHub Copilot).

Managed by [proctl](proctl/) — Provana's plugin manager CLI.

## Install proctl

```bash
cd proctl
npm install -g .
```

## Available plugins

| Plugin | Description | Install |
|---|---|---|
| [core](core/) | Git workflow, API design, bash safety hook | `proctl add 109628/provana-plugins --plugin core` |

## Install a plugin

```bash
# Full plugin
proctl add 109628/provana-plugins --plugin core

# Skills only
proctl add 109628/provana-plugins --plugin core --only skills

# Single skill
proctl add 109628/provana-plugins --plugin core --skill git-workflow

# Target Copilot
proctl add 109628/provana-plugins --plugin core -a copilot
```

## Plugin structure

Each plugin lives in its own subfolder:

```
provana-plugins/
├── core/           ← provana-core plugin
│   ├── plugin.json
│   ├── skills/
│   └── hooks/
├── branching/      ← coming soon
├── postgres/       ← coming soon
└── proctl/         ← the CLI tool itself
```

## List installed plugins

```bash
proctl list
```
