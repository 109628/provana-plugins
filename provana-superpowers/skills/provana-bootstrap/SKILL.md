---
name: provana-bootstrap
description: Use at the start of EVERY session in any Provana project. Loads project context, identifies pod type, establishes skill discipline, syncs with Azure Boards. Trigger on session start, "let's get started", "pick up where we left off", "new session", "resume", or whenever a Provana developer begins a work session. Also use when onboarding a new engineer to a Provana project.
---

# Provana Bootstrap

This skill establishes context and discipline at the start of every session. It is the equivalent of `superpowers:using-superpowers` but wired to Provana's specific platform.

**Announce at start:** "Running provana-bootstrap to load project context and establish skill discipline."

## Step 1: Detect project context

Check for a project-level `CLAUDE.md` or `context.md` in the current directory. If found, read it now. It contains:
- Project name, pod type (Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM), stakeholders
- Current sprint focus, open stories
- Known constraints and architectural decisions

If no project context file exists, ask: "Which pod is this for? (Conv.AI / Doc.AI / BPM / Other)" — then load the appropriate scaffold from `context-templates/`.

## Step 2: Sync with Azure Boards (if MCP connected)

If Azure Boards MCP is available:
- Pull open stories assigned to this session's developer
- Identify in-progress items that need continuation
- Surface any blockers flagged since last session

If not connected: ask the human partner to confirm which story/task to focus on.

## Step 3: Load decisions log

Read `docs/decisions.md` if it exists. This is the running log of what was decided and why. You need this to avoid re-litigating settled decisions and to understand the architectural context of any current task.

## Step 4: Establish skill discipline

State clearly:

> I'm operating under the Provana AI-Native Delivery Model with superpowers v5.1.0 skill discipline. Before any action I will check whether a Provana skill applies. If you see me about to write code without invoking a skill, stop me.

Remind yourself and the human partner of the current phase:
- **Discovery + Spec** → `bmad-discovery` then `writing-provana-plans`
- **Build** → `subagent-driven-delivery` + `provana-tdd`
- **QA + Verify** → `agent-qc-harness` + `requesting-provana-review`
- **Merge + Memory** → hooks fire automatically (mem-compile, board-sync)
- **Change / Roadblock** → `mid-sprint-change`
- **Go-live + Handoff** → `finishing-provana-branch`

## Step 5: Onboarding path (new engineer)

If this is a new engineer's first session on a project, do the following:

1. Read the project `CLAUDE.md` and summarise the product in 3 sentences
2. Read `docs/PRD.md` and identify the current delivery focus
3. Read `docs/decisions.md` and flag the 3 most recent decisions they need to know
4. Confirm the onboarding prompt works: `"Tell me what we're building and where we are"`

## Context discipline

After bootstrap, remind yourself: root context file is <800 tokens. If you find yourself loading more than 3-4 large files into context simultaneously, stop and use nested file references instead.

## What comes next

Announce which phase the project is in and ask: "Where would you like to start today?"
