# provana-plugins

Provana's plugin registry for AI coding agents (Claude Code + GitHub Copilot).

Managed by `proctl` — Provana's plugin manager CLI.

---

## Setup (one-time per machine)

### Step 1 — Generate GitHub PAT

Go to: https://github.com/settings/tokens/new

- Token type: **Classic**
- Scope: ✅ `read:packages` only
- Expiration: 90 days or no expiration

### Step 2 — Configure npm

Add to `~/.npmrc` (create if it doesn't exist):

```
@109628:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PAT_HERE
```

### Step 3 — Install proctl

```bash
npm install -g @109628/proctl
proctl --version
```

---

## Discover available plugins

```bash
proctl list --available 109628/provana-plugins
```

---

## Install a plugin

```bash
# Browse then install
proctl list --available 109628/provana-plugins
proctl add 109628/provana-plugins --plugin core

# Skills only (no hooks/MCP)
proctl add 109628/provana-plugins --plugin core --only skills

# Single skill
proctl add 109628/provana-plugins --plugin core --skill git-workflow

# Target Copilot instead of Claude Code
proctl add 109628/provana-plugins --plugin core -a copilot

# See what's installed
proctl list

# Remove a plugin
proctl remove provana-core
```

---

## Available plugins

| Plugin | Install | Skills | MCP | Hooks | For |
|---|---|---|---|---|---|
| `core` | `--plugin core` | git-workflow, api-design | — | bash-guard | All |
| `design` | `--plugin design` | ui-ux, design-system, ui-styling | — | — | All |
| `ado` | `--plugin ado` | ado-work-items, ado-repositories | azure_devops | — | All |
| `quality` | `--plugin quality` | code-review, test-coverage | — | pre-commit-gate | All |

All installs: `proctl add 109628/provana-plugins --plugin <name>`

---

## Recommended install order (new project)

```bash
proctl add 109628/provana-plugins --plugin core      # always first
proctl add 109628/provana-plugins --plugin ado       # Azure DevOps
proctl add 109628/provana-plugins --plugin quality   # code review + test gates
proctl add 109628/provana-plugins --plugin design    # UI projects
```

---

## Updates

```bash
# Update proctl itself
npm install -g @109628/proctl@latest

# Update a plugin
proctl update provana-core
```

---

## Plugin structure

Each plugin is a subfolder with its own `plugin.json`:

```
provana-plugins/
├── core/       ← git workflow, api design, bash guard, /provana command
├── design/     ← ui-ux, design system, shadcn/ui styling
├── ado/        ← Azure DevOps MCP + work items + repos skills
├── quality/    ← code review, test coverage, pre-commit quality gate
├── proctl/     ← the CLI tool itself
└── scratchpad/ ← spec files for contributors
```

---

## Contributing a new plugin

```bash
proctl init my-plugin-name
# creates my-plugin-name/ with plugin.json scaffold
# move into this repo, fill skills/hooks, commit and push
```
