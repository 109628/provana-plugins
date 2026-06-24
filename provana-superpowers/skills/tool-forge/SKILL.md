---
name: tool-forge
description: Meta-skill for creating new skills, hook scripts, reference docs, and context templates on demand. Use when the existing plugin doesn't cover a domain, technology, or workflow you're encountering. Claude will design and build the new tool, test it against a real scenario, and integrate it into the plugin. Trigger on "create a new skill", "build a tool for", "we need a skill that", "the plugin doesn't cover", "add support for", "make a hook for", "I need Claude to know about", "can you add", "extend the plugin", or any time a domain gap is identified and a reusable tool would close it.
---

# Tool Forge — Self-Extending Plugin Builder

Meta-skill that allows provana-superpowers (or any Claude plugin) to extend itself. When you hit a domain gap, this skill builds a new skill, hook, or reference file and integrates it immediately.

**Announce at start:** "Running tool-forge. Designing new tool."

## What can be built

| Artifact type | When to build it | Output location |
|--------------|-----------------|----------------|
| **Skill** (`SKILL.md`) | Repeatable workflow or domain expertise that will be invoked multiple times | `skills/[name]/SKILL.md` |
| **Hook script** (`.sh`) | Automated check or action that should run at a lifecycle event (pre-commit, post-test, session-end) | `hooks/[name].sh` |
| **Reference file** (`.md`) | Static knowledge, checklists, decision matrices, or persona prompts used by other skills | `references/[name].md` or `skills/[name]/references/[name].md` |
| **Context template** | Document template that projects copy as a starting point | `context-templates/[name].md` |

## Step 1: Understand the gap

Before building anything, define the gap precisely:

```
Gap analysis:
  - What domain or technology is not covered?
  - What is the specific task that fails without this tool?
  - How often will this be needed? (One-off → don't build; recurring → build)
  - Who invokes it? (Tech FDE, PM/QA, Agentic SRE, LLMOps, or general use?)
  - Does an existing skill partially cover this? (Extend instead of creating new)
  - What would the trigger phrases be?
```

Ask the human partner to confirm the gap description before designing.

## Step 2: Design the tool

### For a new skill

Apply superpowers v5.1.0 skill structure:

```yaml
---
name: [kebab-case-name]
description: [One sentence: what it does. Then: "Trigger on" + 5–10 exact phrases that should invoke it.]
---
```

Skill design principles:
- **Single responsibility**: one skill, one domain. If it covers two unrelated things, split it.
- **Under 500 lines**: if longer, move reference material to `references/` subdirectory.
- **Announce at start**: every skill begins with `"Running [skill-name]. [One-line description of what it's doing.]"`
- **No assumptions about project type**: skills should work for Provana projects AND general use unless explicitly Provana-specific.
- **Structured output**: skills produce artefacts (ADRs, plans, reports, code) not just prose.
- **Decision criteria before recommendations**: always establish requirements before recommending a service/pattern/approach.

### For a new hook script

Hook design principles:
- **Exit 0**: hooks that are warnings should always exit 0. Never block on a false positive.
- **Exit 1**: only block when there is a clear, definite violation (secret in code, test failure).
- **Idempotent**: hook can run multiple times without side effects.
- **Fast**: hooks should complete in under 5 seconds. Slow hooks get disabled.
- **Clear output**: every warning or error message must tell the developer exactly what to fix.

```bash
#!/usr/bin/env bash
# [hook-name].sh — [one-line description]
# provana-superpowers v1.0
#
# [When it runs. What it checks. Exit codes.]

set -uo pipefail

# [Logic]

exit 0  # or exit 1 for blocking errors
```

### For a reference file

Reference files are consumed by skills and humans. Structure:
- Decision matrices (when to use what)
- Checklists (ordered steps)
- Persona prompts (for subagent dispatch)
- Glossaries (domain-specific terms)

Reference files have no YAML frontmatter — they're plain markdown.

## Step 3: Write the tool

Write the full artifact. Do not write a placeholder — write a complete, production-ready tool.

For skills: include at least one worked example, one decision matrix, and one architecture pattern.

For hooks: include comments explaining every non-obvious line. Test with `bash -n [hook].sh` to verify syntax.

For reference files: include enough context that someone reading it for the first time can apply it without needing to read anything else.

## Step 4: Self-test

Before integrating, validate the tool against a real scenario:

### Skill self-test

```
Test scenario: [describe a real situation where this skill would be invoked]

Run through the skill mentally:
  - Would the trigger description match this scenario? (yes/no)
  - Does the skill produce a specific, actionable output for this scenario?
  - Are there edge cases the skill doesn't handle? (document them)
  - Does the skill reference any files that don't exist yet? (create them)
```

### Hook self-test

```bash
# Syntax check
bash -n hooks/[new-hook].sh

# Dry run with a benign test case
[set up test environment]
bash hooks/[new-hook].sh

# Verify exit code
echo "Exit code: $?"
```

## Step 5: Integrate

### Register in plugin.json

```json
{
  "skills": [
    "... existing skills ...",
    "skills/[new-skill-name]"
  ]
}
```

### Register hook in hooks/settings.json (if applicable)

Add the hook to the appropriate lifecycle event in `hooks/settings.json`.

### Update cross-reference files

- `references/skills-taxonomy.md` — add to the correct phase and role row
- `references/pod-skills-map.md` — add if pod-specific
- `CLAUDE.md` (plugin root) — add to skill invocation table if it's a primary skill
- `INSTALL.md` — add to the skill reference table

### Update context-templates/CLAUDE.md

If the new skill should be in every project's skill invocation table, add it.

## Step 6: Document the addition

Append to `docs/decisions.md` in any project that will use this skill:

```
[DATE] tool-forge: Created new skill [skill-name].
  Gap: [what the plugin didn't cover].
  Domain: [domain].
  Trigger: [primary trigger phrase].
  Integrated: plugin.json, skills-taxonomy.md, CLAUDE.md.
```

---

## Examples of when to use tool-forge

**"We're using Terraform for IaC — the plugin doesn't cover it."**
→ Build `skills/terraform-design/SKILL.md` covering module structure, state management, Azure provider patterns, and a pre-commit hook that runs `terraform validate`.

**"We need to handle GDPR data subject access requests."**
→ Build `skills/gdpr-compliance/SKILL.md` covering DSARs, data mapping, retention policies, and a reference file with the GDPR Article 30 record-of-processing template.

**"Our Doc.AI pipeline needs to handle Arabic and Hebrew (right-to-left) documents."**
→ Extend `skills/doc-pipeline-scaffold/SKILL.md` with an RTL section, OR build `skills/multilingual-doc-ai/SKILL.md` if the domain is broad enough.

**"We keep forgetting to update the observability config when we add new pipelines."**
→ Build `hooks/observability-drift.sh` that compares pipeline files in `src/` against entries in `docs/observability-config.md` and warns when new pipelines have no monitoring entry.

**"We want Claude to always check our internal security policies before recommending Azure services."**
→ Build `references/azure-security-policy.md` with the approved services list, data residency requirements, and Managed Identity usage rules — then reference it from `azure-cloud-design`.

---

## What tool-forge is NOT

- **Not a replacement for bmad-discovery**: if you're building a new product feature, not a new tool, use `bmad-discovery` + `writing-provana-plans`.
- **Not for one-off tasks**: if this will only ever run once, just do it inline rather than building a skill.
- **Not for patching existing skills**: to modify an existing SKILL.md, edit it directly. Use `tool-forge` only for net-new tools.
