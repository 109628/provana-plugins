# Story [NNN]: [Story Title]
<!-- Template: docs/story-NNN.md in each Provana project repo -->
<!-- Produced by: bmad-discovery skill (BMAD PM mode) -->
<!-- Numbered sequentially. Story ACs are the contract for agent-qc-harness. -->

**Pod:** [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]
**Sprint:** [Sprint number]
**Priority:** [P0 / P1 / P2]
**Status:** [Draft / Ready for Dev / In Progress / Ready for Review / Done]
**Azure Board item:** [AB#NNN]

---

## User story

As a [user role], I want [capability], so that [benefit/outcome].

## Context

[1-2 sentences providing background that helps the developer and QA agent understand why this story exists. Reference the PRD section if relevant.]

## Acceptance criteria

> These are the test contract. Every AC must have a corresponding test in tests/qc/test_story_NNN_acs.py.
> ACs must be specific, measurable, and binary (pass/fail). Vague ACs block QC.

**AC1:** [Specific, testable condition]
- Input: [exact input]
- Expected output: [exact expected output or behaviour]
- Pass condition: [measurable criterion]
- Fail condition: [what constitutes failure]

**AC2:** [Specific, testable condition]
- Input:
- Expected output:
- Pass condition:
- Fail condition:

**AC3:** [Edge case — always include at least one]
- Input: [edge case input]
- Expected output:
- Pass condition:
- Fail condition:

**AC4 — SLO assertion:** [Pod-specific SLO must be an AC]
- Conv.AI: Turn response latency p95 <500ms
- Doc.AI: Extraction accuracy >85% per field on ground-truth dataset
- BPM: 100% deterministic step compliance on SOP test suite

## Pod-specific requirements

**Pod 1 — Conv.AI additions:**
- Escalation triggers: [what phrases or intents trigger human transfer]
- Persona reference: `src/conv_ai/personas/[persona-file].yaml`
- Voice quality rubric target: MOS >3.5, latency <500ms

**Pod 2 — Doc.AI additions:**
- Document types in scope: [list]
- Schema version: [version number]
- Missing field behaviour: must return `None` + `missing_fields` list (not silent failure)
- Confidence threshold: [value] — below this, flag to human

**Pod 3 — BPM additions:**
- SOP reference: `docs/[sop-file].yaml`
- Judgment steps: [list steps that must be flagged to human, not auto-resolved]
- Output audience: [technical / non-technical stakeholder]

## Out of scope

- [Explicit exclusion 1]
- [Explicit exclusion 2]

## Dependencies

- [Dependency 1: another story, external API, data availability]

## Test notes

[Any specific guidance for the BMAD QA agent generating tests from these ACs. For example: "AC2 requires the ground-truth dataset at tests/doc_ai/ground_truth/invoices/"]

---

## Change log

| Date | Change | Reason | Approved by |
|------|--------|--------|-------------|
| [date] | Initial version | — | [PM/QA name] |

> **CHANGED [date]:** [Note any mid-sprint changes. Do not rewrite ACs — add change log entries.]
