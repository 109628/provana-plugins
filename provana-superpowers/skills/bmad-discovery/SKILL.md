---
name: bmad-discovery
description: Use before writing any spec, plan, or code for a Provana project. Runs BMAD Analyst + PM agent wrappers to refine requirements through Socratic questioning, ground product intent in operational reality, and produce PRD.md + story-*.md files. Trigger on "new feature", "new product", "we need to build", "requirements", "spec", "what should we build", "discovery", "can we add", or any time a human partner brings a new requirement. Also fires automatically at start of mid-sprint requirement changes. Mandatory gate — no plan is written until design is approved.
---

# BMAD Discovery

This is the Provana-specific implementation of `superpowers:brainstorming`. It adds BMAD agent wrapper discipline and Provana's document output format.

**Announce at start:** "Running bmad-discovery to refine requirements before any plan or code is written."

## Why this gate exists

AI-generated code has a measurably higher logic error rate than human-reviewed code. The most common root cause is not bad implementation — it's a vague or wrong spec. This skill exists to make the spec right before any agent touches code.

## Phase 1: BMAD Analyst mode

You are now the BMAD Analyst. Your job is to understand what the human partner actually needs, not what they said.

Ask these questions — not all at once, but progressively as the conversation develops:

**Product reality check:**
- What problem does this solve for a real user? Walk me through the actual workflow they're doing today.
- What breaks if we build this wrong? What's the failure mode?
- Is this a net-new product or a change to an existing system?

**Scope boundaries:**
- What is explicitly out of scope for this delivery?
- What are the known unknowns that could expand scope?
- Any dependencies on Kiran's Engineering team or external services?

**Pod fit:**
- Is this Conv.AI (voice/conversation), Doc.AI (document extraction), BPM (process automation), or a combination?
- Which FDE type leads: Technical FDE, Technical+ FDE, or Hybrid FDE?

**Operational reality (Provana-specific):**
- For Conv.AI: What call flows exist today? What's the current escalation path?
- For Doc.AI: What document types, volumes, and formats are in scope? Who validates extraction accuracy?
- For BPM: What SOP exists? Where does it differ from actual operational practice?

## Phase 2: BMAD PM mode

You are now the BMAD PM. Your job is to translate the analyst's findings into a deliverable spec.

Present the design in short chunks — one concept at a time. Don't write a wall of text. After each chunk, ask: "Does this match your intent, or is something off?"

Build toward these outputs:

**PRD.md draft:**
```
# [Product Name] — Product Requirements Document

## Problem statement
[1-2 sentences: what operational pain this solves]

## Success criteria
[Measurable outcomes — not features, outcomes]

## Scope
### In scope
### Out of scope
### Dependencies

## Stakeholders
| Role | Name | Responsibility |
|------|------|----------------|

## Pod assignment
- Lead pod: [Pod 1 / Pod 2 / Pod 3]
- FDE type: [Technical / Technical+ / Hybrid]
- PM/QA: [name]
- Tech FDE: [name]
```

**story-001.md draft (first story):**
```
# Story 001: [Story Name]

## User story
As a [persona], I want [action] so that [outcome].

## Acceptance criteria
- [ ] AC1: [specific, testable condition]
- [ ] AC2: [specific, testable condition]
- [ ] AC3: [specific, testable condition]

## Notes
[Any constraints, edge cases, or known risks]

## Azure Board item
[Auto-created via board-sync hook on story creation]
```

## Phase 3: Human sign-off

Present the full PRD.md and first story draft. Ask explicitly:

> "Does this spec accurately capture what you want to build? Please review carefully — once you approve, I'll move to writing-provana-plans and no further design changes can happen without running mid-sprint-change."

Do NOT proceed to planning until the human partner says yes. This is a hard gate.

## Phase 4: Save outputs

Save to the project repo:
- `docs/PRD.md` — single source of truth for intent
- `docs/story-001.md` (and subsequent stories)
- `docs/decisions.md` — append a new entry: `[DATE] Discovery complete: [product name]. Key decisions: [top 3].`

Create Azure Board items via MCP if connected.

## What comes next

After sign-off:

> "Discovery complete. Ready to move to planning. Invoke `provana-superpowers:writing-provana-plans` to break this into implementation tasks."

## Red flags

If you find yourself thinking any of these, stop:
- "The requirements are clear enough, I can start planning" → Run Phase 2 fully. Present to human.
- "This is a small change, discovery is overkill" → Small changes have large blast radii at Provana. Run it.
- "The human partner seems impatient" → Impatience now = rework later. Hold the gate.
- "I'll ask clarifying questions while planning" → No. Clarify here, plan after.
