---
description: Show all installed Provana plugins and available plugins from the registry
---

Run `proctl list` to show installed plugins, then show the full available plugin catalogue.

Show this table of all available Provana plugins:

## Installed plugins
(run proctl list and show output here)

## Available plugins from 109628/provana-plugins

| Plugin | Install command | Skills | MCP | Hooks | Teams |
|---|---|---|---|---|---|
| `core` | `proctl add 109628/provana-plugins --plugin core` | git-workflow, api-design | — | dangerous-bash-guard | All |
| `design` | `proctl add 109628/provana-plugins --plugin design` | ui-ux, design-system, ui-styling | — | — | All |
| `ado` | `proctl add 109628/provana-plugins --plugin ado` | ado-work-items, ado-repositories | azure_devops | — | All |
| `quality` | `proctl add 109628/provana-plugins --plugin quality` | code-review, test-coverage | — | pre-commit-quality-gate | All |
| `fastapi` | `proctl add 109628/provana-plugins --plugin fastapi` | fastapi-patterns, docker-setup | langfuse | ruff-lint | Engineering |
| `postgres` | `proctl add 109628/provana-plugins --plugin postgres` | schema-design, query-patterns | postgresql | — | Engineering, Data |
| `nextjs` | `proctl add 109628/provana-plugins --plugin nextjs` | nextjs-patterns, component-design | — | eslint-on-edit | Engineering |
| `databricks` | `proctl add 109628/provana-plugins --plugin databricks` | databricks-cdc, delta-lake | databricks | — | Data |
| `livekit` | `proctl add 109628/provana-plugins --plugin livekit` | livekit-agent-patterns | livekit | audio-file-guard | AI |
| `langfuse` | `proctl add 109628/provana-plugins --plugin langfuse` | tracing-patterns, prompt-mgmt | langfuse | — | AI |
| `deploy` | `proctl add 109628/provana-plugins --plugin deploy` | aca-deploy, azure-devops-push | — | deploy-safety-guard | DevOps |
| `compliance` | `proctl add 109628/provana-plugins --plugin compliance` | regulatory-standards, owasp | — | dep-vuln-scan | All |

## Recommended install order for new projects

```bash
# Foundation (always)
proctl add 109628/provana-plugins --plugin core
proctl add 109628/provana-plugins --plugin ado
proctl add 109628/provana-plugins --plugin quality

# By domain
proctl add 109628/provana-plugins --plugin fastapi    # Python microservices
proctl add 109628/provana-plugins --plugin nextjs     # Frontend
proctl add 109628/provana-plugins --plugin databricks # Data engineering
proctl add 109628/provana-plugins --plugin livekit    # Voice AI

# Before shipping
proctl add 109628/provana-plugins --plugin compliance
proctl add 109628/provana-plugins --plugin deploy
```

## Update all installed plugins

```bash
proctl list  # see what's installed and current versions
proctl update provana-core
proctl update provana-quality
# etc.
```
