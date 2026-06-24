# QA Plan — Story [NNN]: [Story Title]
<!-- Template: docs/qa-plan-NNN.md -->
<!-- Produced by: agent-qc-harness skill (BMAD QA agent) -->
<!-- PM/QA signs off on this before merge is permitted. -->

**Story:** [NNN]
**Pod:** [Pod 1 Conv.AI / Pod 2 Doc.AI / Pod 3 BPM]
**Build:** [git commit hash]
**QA date:** [YYYY-MM-DD]
**QA agent version:** BMAD QA (provana-superpowers v5.1.0)

---

## AC verification results

| AC | Test file | Test function | Result | Notes |
|----|-----------|--------------|--------|-------|
| AC1 | tests/qc/test_story_NNN_acs.py | test_ac1_[description] | ✅ PASS / ❌ FAIL | |
| AC2 | tests/qc/test_story_NNN_acs.py | test_ac2_[description] | ✅ PASS / ❌ FAIL | |
| AC3 | tests/qc/test_story_NNN_acs.py | test_ac3_edge_case | ✅ PASS / ❌ FAIL | |
| AC4 (SLO) | tests/qc/test_story_NNN_acs.py | test_ac4_slo | ✅ PASS / ❌ FAIL | |

## Hallucination check

**Result:** [PASS / FAIL]
**Fabricated facts found:** [none / list]
**Confidence violations:** [none / list]
**Scope violations:** [none / list]

Zero tolerance applies to:
- Conv.AI: any factual claim about customer account
- Doc.AI: any extracted field value
- BPM: any process instruction or compliance statement

## Domain QC results

### Pod 1 — Conv.AI voice harness

| Check | Result | Value | SLO |
|-------|--------|-------|-----|
| Intent accuracy | ✅ / ❌ | [N]% | >90% |
| Escalation accuracy | ✅ / ❌ | [N]% | 100% |
| Turn latency p95 | ✅ / ❌ | [N]ms | <500ms |
| TTS naturalness (MOS) | ✅ / ❌ | [N] | >3.5 |

### Pod 2 — Doc.AI extraction QC

| Field | Accuracy | SLO | Result |
|-------|---------|-----|--------|
| [field 1] | [N]% | >85% | ✅ / ❌ |
| [field 2] | [N]% | >85% | ✅ / ❌ |
| Missed field rate | [N]% | <5% | ✅ / ❌ |
| Below-threshold fields flagged | [N]% | 100% flagged | ✅ / ❌ |

### Pod 3 — BPM compliance QC

| Check | Result | Notes |
|-------|--------|-------|
| Deterministic steps: SOP compliance | ✅ 100% / ❌ [N]% | |
| Judgment steps: all flagged to human | ✅ / ❌ | |
| Exception paths: correct escalation | ✅ / ❌ | |
| Stakeholder output: non-technical language | ✅ / ❌ | |

## Failures requiring fix

<!-- List any FAIL items with specific description of what failed -->

| AC | Failure description | Severity | Action required |
|----|-------------------|---------|----------------|
| [AC] | [what failed exactly] | [Critical/Important] | [what to fix] |

## PM/QA verdict

```
[ ] PASS — all ACs met, no hallucinations, domain QC passed
[ ] CONDITIONAL PASS — [specify conditions and timeline]
[ ] FAIL — [specify what must be fixed before re-review]
```

**PM/QA signature:** _________________________ **Date:** ___________

---

## Re-review (if FAIL)

**Fixed items:** [list]
**Re-run date:** [date]
**Re-run result:** [PASS / CONDITIONAL PASS / FAIL]
**Final verdict:** [verdict]
