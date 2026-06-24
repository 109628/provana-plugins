# Product Requirements Document
<!-- Template: docs/PRD.md in each Provana project repo -->
<!-- Produced by: bmad-discovery skill (BMAD Analyst + PM mode) -->
<!-- Sign-off required: PM/QA before any plan is written -->

**Project:** [Project name]
**Pod type:** [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]
**Version:** 1.0
**Date:** [YYYY-MM-DD]
**Status:** [Draft / Under Review / Approved]

---

## Problem statement

[2-3 sentences: what problem does this solve? Who experiences it? What is the measurable impact of not solving it?]

## Users and stakeholders

| Role | Needs | Success metric |
|------|-------|---------------|
| [Primary user] | [what they need] | [how we measure satisfaction] |
| [Stakeholder] | [what they need] | [how we measure satisfaction] |

## Goals

1. [Goal 1 — specific and measurable]
2. [Goal 2]
3. [Goal 3]

## Non-goals (explicit out of scope)

- [Thing we are explicitly NOT building]
- [Constraint we are accepting]

## Functional requirements

### Core capabilities

1. **[Capability name]**
   Description: [what it does]
   Input: [what goes in]
   Output: [what comes out]
   SLO: [latency / accuracy / compliance threshold]

2. **[Capability name]**
   Description:
   Input:
   Output:
   SLO:

### Pod-specific requirements

**Pod 1 — Conv.AI:**
- [ ] Voice persona defined (name, tone, escalation triggers)
- [ ] STT engine specified (Azure Cognitive Services / other)
- [ ] TTS engine specified
- [ ] Supported intents listed
- [ ] Escalation paths defined (when to transfer to human)
- [ ] Latency SLO: <500ms p95 turn response

**Pod 2 — Doc.AI:**
- [ ] Document types in scope listed
- [ ] Extraction fields defined (field name, type, confidence threshold)
- [ ] Output schema version specified
- [ ] Ground-truth dataset size: minimum 50 labelled docs per type
- [ ] Accuracy SLO: >85% per field

**Pod 3 — BPM:**
- [ ] Business process mapped (deterministic steps vs judgment steps identified)
- [ ] SOP document provided or to be discovered
- [ ] Judgment escalation paths defined
- [ ] Stakeholder-facing output language approved
- [ ] Process compliance SLO: 100% deterministic step compliance

## Non-functional requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| Latency | [threshold] | Per pod SLO above |
| Availability | [target] | |
| Data residency | [requirement] | SOC2 / client policy |
| PII handling | [what's allowed] | |
| Audit logging | [what must be logged] | |

## Constraints and dependencies

- **External APIs:** [list dependencies: Azure, OpenAI, LiveKit, etc.]
- **Client data access:** [what data the system can and cannot access]
- **Model selection:** [any constraints on which models can be used]
- **Timeline:** [sprint or delivery deadline]

## Success criteria

| Metric | Baseline | Target | How measured |
|--------|---------|--------|-------------|
| [metric] | [current] | [goal] | [measurement method] |

## Open questions

| # | Question | Owner | Due |
|---|---------|-------|-----|
| 1 | [question] | [name] | [date] |

---

## Change log

| Date | Change | Reason | Approved by |
|------|--------|--------|-------------|
| [date] | Initial version | — | [PM/QA name] |

> **CHANGED [date]:** [Note any mid-sprint changes here, not by rewriting history]
