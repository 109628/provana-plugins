---
name: bpm-discovery
description: Use for all Pod 3 BPM and process automation work at Provana. Runs structured process discovery interviews, builds process maps, scores feasibility of automation vs human judgment, identifies SOP gaps vs operational reality, packages discovery findings into a tech team brief, and creates non-technical AI explainers for stakeholders. Trigger on "BPM", "process automation", "SOP", "workflow", "process map", "automate this process", "how does this work today", "business process", "feasibility", "explorative", or any Pod 3 delivery work.
---

# BPM Discovery

Pod 3 domain skill for BPM / Explorative work. The Hybrid FDE type means the PM/QA role leads discovery (not the Tech FDE), and stakeholders often don't understand AI capabilities. This skill is designed to bridge that gap.

**Announce at start:** "Running bpm-discovery for Pod 3 (BPM / Process Automation) work."

## Why BPM discovery is different

Pod 3 challenges (from Provana's model):
- Vague requirements: BPM stakeholders describe outcomes, not processes
- Control dynamics: BPM team wants control, resists AI intervention
- AI literacy gap: stakeholders don't understand what AI can and cannot do
- SOP vs reality: documented SOPs often diverge significantly from actual practice

This skill is built to navigate all of these.

## Phase 1: Process discovery interview

Run with the business stakeholder AND the PM/QA lead. Do not run with Tech FDE present — it changes the conversation dynamic.

```markdown
## BPM Discovery Interview

**The process today (walk through it):**
- Walk me through a typical case from start to finish, step by step
- Who does each step? (role, not person name)
- How long does each step typically take?
- What information does the person need to complete each step?
- What tools do they use? (systems, spreadsheets, email, phone)
- Where do they make a judgment call vs follow a rule?

**Variation and exceptions:**
- What percentage of cases follow the standard path?
- What are the top 3 exception types? Walk me through each.
- What happens when the system has the wrong information?
- Who escalates? To whom? Under what conditions?

**SOP audit:**
- Do you have a documented SOP? May I see it?
- Where does actual practice differ from the SOP?
- What knowledge lives only in people's heads, not in the SOP?

**Volume and timing:**
- How many cases per day/week/month?
- Are there peak periods? What drives them?
- What's the acceptable processing time SLO?

**Success definition:**
- What does "good" look like? How would you know if AI was doing this well?
- What's the cost of an error? (financial, operational, compliance)
- Who signs off on AI output before it takes effect?
```

## Phase 2: Process map

Build the process map from the interview. Use this structure:

```markdown
# [Process Name] — Process Map

## Overview
[2-3 sentences describing the process and its purpose]

## Participants
| Role | Responsibility in this process |
|------|-------------------------------|

## Standard flow
| Step | Actor | Action | Input | Output | Judgment required? |
|------|-------|--------|-------|--------|-------------------|
| 1 | [role] | [action] | [input] | [output] | No — deterministic |
| 2 | [role] | [action] | [input] | [output] | Yes — [reason] |

## Exception paths
### Exception type 1: [name]
[step-by-step exception handling]

## SOP gaps identified
| SOP says | Actual practice | Impact |
|----------|-----------------|--------|
```

## Phase 3: Feasibility scoring

For each step in the process map, score automation feasibility:

```markdown
## Feasibility Assessment

| Step | Type | Automatable? | Reason | AI confidence needed |
|------|------|-------------|--------|---------------------|
| [step] | Deterministic | Yes | Rule-based, no judgment | N/A |
| [step] | Judgment | Partial | AI assists, human decides | >90% |
| [step] | Judgment | No | Requires domain expertise | — |
| [step] | Communication | Yes | Template-based | >85% |
```

**Automation decision rules:**
- Deterministic + rule-based → automate fully
- Pattern-based with known exceptions → automate with exception escalation
- Requires domain judgment → AI assists, human decides (always)
- Compliance or legal consequence → human sign-off required regardless

## Phase 4: SOP gap analysis

Compare documented SOP to actual practice discovered in Phase 1:

```markdown
## SOP Gap Analysis

### Gaps that matter for AI design
| Gap | SOP says | Reality | AI implication |
|-----|----------|---------|----------------|
| [gap] | [SOP text] | [actual practice] | [how this changes AI behaviour] |

### Tribal knowledge to encode
[Knowledge that exists only in people's heads, needs explicit encoding in AI system]
```

## Phase 5: Handoff packager

Produce the discovery → tech team brief:

```markdown
# [Process Name] — Tech Team Brief

## What we're building
[Non-technical description for stakeholders]
[Technical description for Tech FDE]

## Automatable steps (AI handles)
[list with confidence thresholds]

## Judgment steps (human decides, AI assists)
[list with escalation triggers]

## Steps that stay fully manual
[list with rationale]

## Integration requirements
[Systems, APIs, data sources Tech FDE needs access to]

## Success metrics
[How PM/QA and stakeholders will verify AI is working correctly]

## Risk register
[Known risks, edge cases, compliance considerations]
```

## Phase 6: Stakeholder AI explainer

The Hybrid FDE owns stakeholder communication. Produce a non-technical explainer:

```markdown
# How AI Will Handle [Process Name]
*For [stakeholder team] — plain language summary*

## What the AI does
[Simple description — avoid jargon]

## What stays with your team
[Be specific — stakeholders need to know what they keep control of]

## How you verify it's working
[Concrete examples of what good output looks like]

## What happens when AI is uncertain
[Escalation path — human always in control for edge cases]
```

## What comes next

After discovery is complete and stakeholders have signed off:
1. PM/QA creates story files from the process map
2. Invoke `provana-superpowers:writing-provana-plans` with the tech team brief as input
3. Tech FDE joins at handoff (not during discovery)
