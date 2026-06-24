---
name: context-manager
description: Adaptive context manager for provana-superpowers. Controls which skills are loaded into working context at any given time, preventing context bloat across 18+ skills. Maintains a session skill registry, lazy-loads skills on demand, and evicts cold context when the session shifts domain. Trigger on "context is getting long", "load only what's needed", "clean up context", "too many skills loaded", "context management", or automatically invoked by the skill-router hook at session start and on domain shift.
---

# Adaptive Context Manager

Keeps Claude's working context lean across a plugin with 18+ skills. The default state is minimal — skills are loaded only when needed, held only while active, and released when the domain shifts.

**Announce at start:** "Running context-manager. Auditing session skill state."

## The problem this solves

With 18 skills in the plugin, naively loading all SKILL.md files at session start would consume ~15,000–20,000 tokens of context before any work begins. The root CLAUDE.md target is <800 tokens. Every skill loaded adds ~500–1,000 tokens. The adaptive context manager enforces the token budget.

## Context tiers

Skills operate in three tiers. Tier determines whether the full SKILL.md is in context.

```
Tier 0 — Always loaded (root context budget: <800 tokens)
  ├── CLAUDE.md (project root)
  ├── Skill router index (see below — ~200 tokens)
  └── Session state file (see below — ~100 tokens)

Tier 1 — Hot (active in current session, full SKILL.md in context)
  ├── Max 3 skills at once
  ├── Loaded on first trigger phrase match
  └── Evicted when session shifts to a different domain

Tier 2 — Warm (referenced but not loaded — only skill name + description)
  ├── Skills mentioned in this session but not actively running
  └── Promoted to Tier 1 on next invocation

Tier 3 — Cold (not referenced this session)
  └── Not in context at all — loaded on demand only
```

## Session state file

Maintained at `/tmp/provana-session-state.json` during the session. Cleared on session end by `mem-compile.sh`.

```json
{
  "sessionId": "[timestamp-based id]",
  "hotSkills": [
    {
      "name": "provana-tdd",
      "loadedAt": "2026-05-12T10:05:00Z",
      "lastUsedAt": "2026-05-12T10:23:00Z",
      "invocationCount": 3
    }
  ],
  "warmSkills": ["writing-provana-plans", "agent-qc-harness"],
  "sessionPhase": "build",
  "projectPod": "doc_ai",
  "tokenBudgetUsed": 2400,
  "tokenBudgetLimit": 4000
}
```

## Skill loading rules

### Load a skill when:
- A trigger phrase from its description matches the current user message
- The skill is explicitly invoked by name
- A running skill calls for another skill (e.g. `provana-tdd` calls `requesting-provana-review`)

### Evict a skill when:
- 3 or more newer skills have been loaded since it was last used
- The session phase shifts (e.g. Discovery → Build shifts out `bmad-discovery`)
- The project pod shifts (e.g. Conv.AI → Doc.AI shifts out `conv-ai-scaffold`)
- User explicitly asks to clean up context

### Never evict:
- `provana-bootstrap` during bootstrap phase
- The skill currently executing
- A skill mid-way through a multi-step workflow

## Domain-to-skill affinity map

The router uses this map to decide what to pre-load based on detected domain:

```
Session phase: discovery
  → pre-load: bmad-discovery
  → context-adjacents: bpm-discovery (if BPM signals present)

Session phase: architecture
  → pre-load: writing-provana-plans
  → context-adjacents: azure-cloud-design, event-driven-design (if design signals)

Session phase: build
  → pre-load: provana-tdd, subagent-driven-delivery
  → context-adjacents: conv-ai-scaffold OR doc-pipeline-scaffold OR bpm-discovery (pod-specific)

Session phase: qc
  → pre-load: agent-qc-harness
  → context-adjacents: requesting-provana-review

Session phase: ops
  → pre-load: agentic-sre-runbook OR llmops-alert-response (based on alert type)
  → context-adjacents: (the other ops skill)

Session phase: system-design (non-Provana)
  → pre-load: azure-cloud-design, event-driven-design (if event signals)
  → context-adjacents: vector-db-design (if RAG/embedding signals)
```

## Context audit procedure

When invoked, run this sequence:

### Step 1: Read current session state

```bash
cat /tmp/provana-session-state.json 2>/dev/null || echo '{"hotSkills":[],"warmSkills":[]}'
```

### Step 2: Assess current turn

Classify the current user message:
- What is the user trying to do right now? (1 sentence)
- Which session phase does this belong to?
- Which pod type is active?
- Which skills are relevant to the next 2–3 turns?

### Step 3: Compute required skill set

```
required = [skills relevant to next 2-3 turns]
hot = [currently loaded skills]

to_load = required - hot
to_evict = hot - required (subject to never-evict rules)
```

### Step 4: Execute context changes

**Loading a skill:**
> "Loading [skill-name] into working context. This skill covers [one-line description]."
Read the SKILL.md. Summarise key decision points relevant to current work (do not reproduce the entire file — extract the relevant section).

**Evicting a skill:**
> "Releasing [skill-name] from working context — session has moved to [new phase]. Re-invoke if needed."
The skill remains available — it's just not in active context. Token budget is freed.

### Step 5: Report context state

```
=== Context State ===
Token budget: [N] / 4000 used
Hot skills: [list]
Evicted this turn: [list]
Loaded this turn: [list]
Session phase: [phase]
```

## Token budget enforcement

| Budget zone | Action |
|-------------|--------|
| <2000 tokens | No action — plenty of headroom |
| 2000–3000 tokens | Warn if loading a new skill would push over 3000 |
| 3000–4000 tokens | Evict the longest-idle Tier 1 skill before loading new one |
| >4000 tokens | Hard stop — evict 2 skills before any new load |

The 4000-token cap on skills is in addition to the project CLAUDE.md (~800 tokens) and conversation history, which are managed by Claude's base context window handling.

## Skill summaries (for Tier 2 warm state)

When a skill is warm (not fully loaded), hold only this summary per skill — not the full SKILL.md:

```
[skill-name]: [one-line trigger description] | Phase: [phase] | Pod: [pod or All]
```

Example warm state (~15 tokens per skill × 18 skills = ~270 tokens total):
```
provana-bootstrap: session start, load project context | Phase: start | Pod: All
bmad-discovery: new feature or product requirement | Phase: discovery | Pod: All
azure-cloud-design: azure service selection + design | Phase: any | Pod: Any
vector-db-design: RAG / vector search architecture | Phase: any | Pod: Any
...
```

This is the default state. All 18 skills present as one-liners (~270 tokens). Full SKILL.md only loaded on activation.

## Integration with other hooks

- `hooks/skill-router.sh` — calls context-manager at session start and on every domain shift
- `hooks/mem-compile.sh` — clears `/tmp/provana-session-state.json` on session end
- `hooks/settings.json` — skill-router registered as a PostToolUse hook on Bash + Edit tools
