---
name: llmops-alert-response
description: Use when an LLMOps alert fires at Provana — token cost spike, model drift, hallucination rate threshold breach, prompt version regression, or context window overflow. Structured triage across Conv.AI, Doc.AI, and BPM systems. Coordinates with Agentic SRE for P0/P1. Trigger on "llmops alert", "token cost spike", "model drift", "hallucinations increased", "prompt regression", "context overflow", "accuracy dropped", "the model is behaving differently", "cost is spiking", or any LLMOps monitoring alert.
---

# LLMOps Alert Response

Structured triage and response for LLMOps alerts across Provana's AI product stack. LLMOps is part of the Core AI team — this skill handles alerts that originate in the AI/ML layer, not the infrastructure layer.

**Announce at start:** "Running llmops-alert-response. Triaging LLMOps alert."

## LLMOps vs Agentic SRE boundary

| Alert type | Owner | Escalation |
|-----------|-------|-----------|
| Token cost spike (>2x baseline) | LLMOps | If P0, escalate to Agentic SRE |
| Model version change causing regression | LLMOps + MLOps | If P0, escalate to Agentic SRE |
| Hallucination rate above threshold | LLMOps | Immediate Agentic SRE notification |
| Prompt version regression | LLMOps | Fix in LLMOps, no Agentic SRE needed unless P1 |
| Context window overflow | LLMOps | May be P1 — check latency impact |
| Accuracy floor breach | LLMOps + MLOps | If user-facing, escalate to Agentic SRE |

Agentic SRE handles the production incident. LLMOps handles the root cause in the AI layer.

## Alert severity

| Severity | Condition | Response time |
|----------|-----------|---------------|
| P0 | Hallucination rate >5% on live user traffic, or cost spike >10x | Immediate + Agentic SRE |
| P1 | SLO breach: accuracy <85% Doc.AI, intent accuracy <90% Conv.AI, or cost >3x | <30 min |
| P2 | Accuracy drift (slower degradation), cost >1.5x without traffic increase | <2 hours |
| P3 | Anomaly in model output, no user impact confirmed | Next working day |

## Step 1: Identify the alert type

Check `hooks/llmops-alert.sh` output or the Azure Monitor alert that fired. Classify:

```
[ ] Cost spike — token spend per hour is above threshold
[ ] Model drift — accuracy or quality metrics degrading over time
[ ] Hallucination spike — HallucinationDetector firing above threshold
[ ] Prompt regression — accuracy dropped after a prompt version change
[ ] Context overflow — requests hitting or exceeding model context window
[ ] Latency spike — LLM response time above SLO (may be context-related)
```

## Step 2: Pull the alert context

```bash
# Recent LLMOps metrics — last 1 hour
az monitor log-analytics query \
  --workspace [workspace-id] \
  --analytics-query "
    customMetrics
    | where timestamp > ago(1h)
    | where name in ('token_cost_per_request', 'llm_latency_p95', 'hallucination_rate', 'intent_accuracy')
    | summarize avg(value), max(value), min(value) by name, bin(timestamp, 5m)
    | order by timestamp desc
  "

# Prompt version log
cat llmops/prompt_versions.log | tail -20

# Recent model config changes
git log --oneline src/[pod]/config/llm_config.yaml | head -10
```

## Step 3: Cost spike response

### Diagnose

Cost spikes have three common causes at Provana:

1. **Context window bloat** — accumulated conversation history or retrieved documents inflating context on every request
2. **Traffic spike** — legitimate volume increase (check Azure Monitor request count)
3. **Prompt version change** — new prompt is longer or retrieves more context

```bash
# Check average token count per request (last 1h vs previous 1h)
az monitor log-analytics query \
  --workspace [workspace-id] \
  --analytics-query "
    customMetrics
    | where name == 'tokens_per_request'
    | where timestamp > ago(2h)
    | summarize avg(value) by bin(timestamp, 1h)
  "
```

### Response

| Cause | Fix |
|-------|-----|
| Context bloat | Reduce context window budget in `llm_config.yaml`, add truncation logic |
| Traffic spike | No fix needed — monitor, alert PM/QA of volume increase |
| Prompt too long | Shorten prompt, re-run `agent-qc-harness` before deploying |
| External API pricing change | Log to `docs/decisions.md`, notify PM |

Log all decisions to `docs/decisions.md`. For prompt changes, update `llmops/prompt_versions.log`.

## Step 4: Model drift response

Model drift is a slow signal — accuracy degrading over days or weeks, not a sudden spike.

### Diagnose

```bash
# Pull 7-day accuracy trend
az monitor log-analytics query \
  --workspace [workspace-id] \
  --analytics-query "
    customMetrics
    | where name in ('intent_accuracy', 'extraction_accuracy', 'sop_compliance_rate')
    | where timestamp > ago(7d)
    | summarize avg(value) by name, bin(timestamp, 1d)
    | order by timestamp asc
  "
```

Determine if the drift correlates with:
- A model version change (check `llmops/prompt_versions.log`)
- A data distribution shift (new document types, new call patterns)
- A training data staleness issue (for fine-tuned models)

### Response

| Type | Action |
|------|--------|
| Model version change caused regression | Coordinate rollback with MLOps (see rollback procedure in LLMOps runbook) |
| Data distribution shift | Collect new examples, add to training set — log as MLOps task |
| Prompt tuning opportunity | Run A/B test in staging, update via `provana-tdd` before deploying |
| Fine-tune staleness | MLOps retrain schedule — log as deferred task |

For any model rollback, coordinate with MLOps and document in `docs/decisions.md`:

```
[DATE] Model rollback: [agent name]. From [new version] to [previous version].
Reason: [accuracy metric] dropped from [baseline] to [current] over [timeframe].
Coordinated with: [MLOps contact]. Rollback verified with: pytest tests/ -v.
```

## Step 5: Hallucination spike response

Hallucination spikes require immediate escalation if on live user traffic.

### P0/P1 — Immediate Agentic SRE notification

If `hallucination_rate > 5%` on production traffic:

```
IMMEDIATE: Notify Agentic SRE
Subject: Hallucination P[severity] — [Agent/Pipeline Name]
Metrics: [rate], [sample of fabricated outputs]
System: [Conv.AI/Doc.AI/BPM]
Action taken so far: [what LLMOps has done]
```

Do not attempt to fix a P0/P1 hallucination issue alone — Agentic SRE coordinates the production response.

### P2/P3 — Investigate in staging

```python
# Run hallucination detector on sample of recent outputs
from src.qc.hallucination_detector import HallucinationDetector

detector = HallucinationDetector()
for output, ground_truth in sample_recent_outputs():
    report = detector.check(output, ground_truth)
    if report.verdict == HallucinationVerdict.FAIL:
        print(report.fabricated_facts)
        print(report.confidence_violations)
```

Common causes:
| Symptom | Likely cause |
|---------|-------------|
| Fabricated account details (Conv.AI) | System prompt not grounding model in retrieved context |
| Fabricated field values (Doc.AI) | Missing `None` + `missing_fields` pattern — model inventing values |
| Fabricated process steps (BPM) | SOP not in context window, model filling from training data |
| Overconfident claims | Temperature too high, or confidence threshold not enforced |

Fix approach: always via `provana-tdd` (RED → GREEN), even for prompt-only changes. Test on staging with `agent-qc-harness` before deploying.

## Step 6: Prompt version regression

When accuracy drops immediately after a prompt version change:

```bash
# Show last 5 prompt version changes
cat llmops/prompt_versions.log | tail -30

# Rollback to previous version
# 1. Identify previous stable version tag
# 2. Update src/[pod]/config/prompts/[prompt-file].yaml
# 3. Run tests to verify
pytest tests/ -v -k "intent" # or extraction, bpm, etc.
```

**Log the rollback in `llmops/prompt_versions.log`:**

```
[DATE] ROLLBACK: [prompt name] from [new version] to [stable version]
Reason: [accuracy metric] dropped [from] → [to] after deployment
Verified: pytest tests/ -v — PASS
Next action: [investigate what went wrong with new version]
```

Never deploy a prompt change to production without:
1. Running `agent-qc-harness` on staging
2. Logging the version change in `llmops/prompt_versions.log`
3. Having a rollback plan ready before the deploy

## Step 7: Context window overflow response

Context window overflow causes silent truncation — the model loses context mid-conversation without erroring.

```bash
# Check for requests hitting the context limit
az monitor log-analytics query \
  --workspace [workspace-id] \
  --analytics-query "
    customMetrics
    | where name == 'context_window_utilization'
    | where value > 0.9
    | where timestamp > ago(24h)
    | order by timestamp desc
  "
```

### Mitigation strategies by pod

**Pod 1 — Conv.AI:**
- Reduce conversation history window (keep last N turns, not full history)
- Summarise earlier turns instead of keeping verbatim
- Review retrieved document size (trim to relevant sections)

**Pod 2 — Doc.AI:**
- Chunk large documents before extraction
- Use sliding window extraction for multi-page documents
- Reduce schema context if extraction prompt is bloated

**Pod 3 — BPM:**
- Review SOP verbosity — summarise deterministic steps
- Remove redundant context (agent already knows this)
- Split complex process flows across multiple LLM calls

For any context window change: test accuracy SLOs before deploying. Context reduction can cause accuracy regression.

## LLMOps metrics reference

| Metric | SLO | Alert threshold |
|--------|-----|----------------|
| Intent accuracy (Conv.AI) | >90% | <85% |
| Escalation accuracy (Conv.AI) | 100% | <100% |
| Turn latency p95 (Conv.AI) | <500ms | >600ms |
| Extraction accuracy per field (Doc.AI) | >85% | <80% |
| Missed field rate (Doc.AI) | <5% | >8% |
| SOP deterministic compliance (BPM) | 100% | <100% |
| Token cost per request | [baseline] | >2x baseline |
| Hallucination rate | 0% | >1% |
| Context window utilization | <80% | >90% |

## Post-incident documentation

After any P0/P1/P2 LLMOps incident, append to `docs/decisions.md`:

```
[DATE] LLMOps incident: [type]. [Agent/Pipeline name]. 
Severity: [P0/P1/P2]. Duration: [start] → [resolved].
Root cause: [precise technical cause].
Fix: [what was changed].
Metrics before/after: [before] → [after].
Coordination: [Agentic SRE / MLOps / other].
Prevention: [what will stop this from recurring].
```

For P0/P1: also trigger `agentic-sre-runbook` for the full blameless postmortem.
