# Provana AI-Native Delivery — Agent Guidelines

> Global context file. Target: <800 tokens. Skills loaded adaptively — do NOT load all at once.

## Platform identity

Operating inside Provana's AI-Native Delivery Model v2.0 (or a general system design session). Core AI team owns this platform: skills, hooks, context management, agentic SRE/DevOps/MLOps/LLMOps.

## Context management — first rule

**Do not load all skills at session start.** The plugin has 26 skills (~15,600+ tokens if fully loaded). Load only what the current work requires.

On session start, `skill-router.sh` runs automatically and writes a routing recommendation to `/tmp/provana-skill-route.md`. Read it. Load only the recommended hot skills.

If the router hasn't run, run it:
```bash
bash hooks/skill-router.sh
```
Then read `/tmp/provana-skill-route.md` and load accordingly.

## Skill loading protocol

```
Default state: ALL skills are warm (one-liner in context only)
On trigger:    Promote matching skill to hot (load full SKILL.md)
At 3 hot:      Evict least-recently-used before loading a new one
On phase shift: Re-run skill-router, re-evaluate hot set
```

**Max hot skills at once: 3** (except during explicit multi-skill workflows like finishing-provana-branch).

## Skill index (warm — one-liner each)

| Skill | Invoke when |
|-------|------------|
| `provana-bootstrap` | Every new session start |
| `bmad-discovery` | New feature / product requirement |
| `writing-provana-plans` | Writing a delivery plan |
| `subagent-driven-delivery` | Orchestrating implementation |
| `provana-tdd` | Writing any code |
| `conv-ai-scaffold` | Pod 1: Conv.AI / LiveKit / voice |
| `doc-pipeline-scaffold` | Pod 2: Doc.AI / extraction pipeline |
| `bpm-discovery` | Pod 3: BPM / process automation |
| `agent-qc-harness` | QA verification of agent output |
| `mid-sprint-change` | Requirements changed mid-sprint |
| `requesting-provana-review` | Code ready for PR review |
| `finishing-provana-branch` | Sprint done / handoff to engineering |
| `agentic-sre-runbook` | Production incident |
| `llmops-alert-response` | Token/cost/drift/hallucination alert |
| `azure-deployment` | Deploy to Azure — containers, functions, storage, postgres, DNS |
| `azure-cloud-design` | Azure service selection / architecture |
| `vector-db-design` | Vector DB / RAG / embeddings |
| `event-driven-design` | Event-driven / distributed systems |
| `qa-automation` | Playwright / desktop / UI / regression tests |
| `voice-pipeline-eval` | Voice bot / STT / TTS / conversation flow QA |
| `tool-forge` | Domain gap — need a new tool |
| `context-manager` | Context bloat / manual context audit |
| `project-init` | New project from zero — git, Azure RG, context wiring |
| `azure-cicd` | Azure DevOps pipeline YAML — build → test → deploy |
| `parallel-build` | Solo dev: parallel worktrees + subagent orchestration |
| `team-collaboration` | Multi-dev: FE + BE + AI engineer working without interference |

## Red flags — stop

- "Simple change, skip the skill" → No. Run it.
- "Skip tests this once" → No. RED first always.
- "Create the worktree" → No. Ask consent first (v5.1.0).
- "Engineering will figure it out" → No. Handoff package is mandatory.
- "Load all skills to be safe" → No. Router decides. Max 3 hot.

## Repository structure

```
provana-ai-platform/   (Core AI — platform)
  CLAUDE.md            ← this file (<800 tokens)
  hooks/               ← quality + routing hooks
  skills/              ← 26 skills, loaded on demand

each-project-repo/     (pod-owned)
  CLAUDE.md            ← project scope (copy from context-templates/)
  docs/PRD.md, arch.md, decisions.md, story-*.md, plans/
  tests/               ← AI-generated + human-reviewed suites
```

## References

- Full skill details: `skills/[name]/SKILL.md` (load on demand)
- Taxonomy + producer map: `references/skills-taxonomy.md`
- Pod-specific guide: `references/pod-skills-map.md`
- Handoff checklist: `references/handoff-checklist.md`
- Context state: `/tmp/provana-skill-route.md` (written by skill-router at session start)
