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

## Updates

```bash
npm install -g @109628/proctl@latest
```

---

## Available plugins

| Plugin | Description | Install command |
|---|---|---|
| `core` | Git workflow, API design, bash safety hook | `proctl add 109628/provana-plugins --plugin core` |
| `design` | UI/UX rules, design system tokens, shadcn/ui patterns | `proctl add 109628/provana-plugins --plugin design` |

---

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

# List what's installed
proctl list

# Remove a plugin
proctl remove provana-core
```

---

## Plugin structure

Each plugin is a subfolder with its own `plugin.json`:

```
provana-plugins/
├── core/           ← git workflow, api design, bash guard hook
├── design/         ← ui-ux, design system, shadcn/ui styling
├── proctl/         ← the CLI tool itself
└── scratchpad/     ← spec files for contributors
```

---

## Contributing a new plugin

```bash
proctl init my-plugin-name
# creates my-plugin-name/ with plugin.json scaffold

# move it into this repo, fill in skills/hooks
# then commit and push
```
