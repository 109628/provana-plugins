#!/usr/bin/env bash
# llmops-alert.sh — LLMOps alert triage trigger
# provana-superpowers v5.1.0
#
# Fires on model/cost anomalies. Pulls current metrics from Azure Monitor,
# classifies the alert, and surfaces a structured triage prompt.
# Invoke llmops-alert-response skill for full response.
#
# Usage:
#   hooks/llmops-alert.sh --type [cost|drift|hallucination|prompt|context] --agent [name]
#   Called automatically by settings.json Notification hook.

set -uo pipefail

ALERT_TYPE="${ALERT_TYPE:-unknown}"
AGENT_NAME="${AGENT_NAME:-unknown}"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
AZURE_WORKSPACE="${AZURE_WORKSPACE:-}"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --type) ALERT_TYPE="$2"; shift 2 ;;
    --agent) AGENT_NAME="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "=== LLMOps Alert ==="
echo "Time: $TIMESTAMP"
echo "Type: $ALERT_TYPE"
echo "Agent: $AGENT_NAME"
echo ""

# ── Pull recent metrics if workspace is configured ─────────────────────────────
if [ -n "$AZURE_WORKSPACE" ]; then
  echo "Pulling metrics from Azure Monitor..."
  az monitor log-analytics query \
    --workspace "$AZURE_WORKSPACE" \
    --analytics-query "
      customMetrics
      | where timestamp > ago(1h)
      | where name in ('token_cost_per_request', 'llm_latency_p95', 'hallucination_rate', 'intent_accuracy', 'extraction_accuracy', 'tokens_per_request')
      | summarize avg(value), max(value) by name
      | order by name asc
    " 2>/dev/null || echo "  (Azure Monitor query failed — check AZURE_WORKSPACE config)"
  echo ""
fi

# ── Classify severity ──────────────────────────────────────────────────────────
SEVERITY="P3"
case "$ALERT_TYPE" in
  hallucination)
    SEVERITY="P0"
    echo "🚨 P0 ALERT: Hallucination rate threshold breached"
    echo "   IMMEDIATE ACTION REQUIRED"
    echo "   1. Notify Agentic SRE immediately"
    echo "   2. Run: provana-superpowers:llmops-alert-response"
    echo "   3. Run: provana-superpowers:agentic-sre-runbook (P0)"
    ;;
  cost)
    SEVERITY="P1"
    echo "⚠️  P1 ALERT: Token cost spike detected"
    echo "   Run: provana-superpowers:llmops-alert-response"
    echo "   Check: context window size, prompt length, traffic volume"
    ;;
  drift)
    SEVERITY="P2"
    echo "⚠️  P2 ALERT: Model drift detected"
    echo "   Run: provana-superpowers:llmops-alert-response"
    echo "   Check: accuracy trend over 7 days, recent prompt/model changes"
    ;;
  prompt)
    SEVERITY="P2"
    echo "⚠️  P2 ALERT: Prompt version regression detected"
    echo "   Run: provana-superpowers:llmops-alert-response"
    echo "   Check: llmops/prompt_versions.log, consider rollback"
    ;;
  context)
    SEVERITY="P2"
    echo "⚠️  P2 ALERT: Context window overflow detected"
    echo "   Run: provana-superpowers:llmops-alert-response"
    echo "   Check: context budget in llm_config.yaml, truncation logic"
    ;;
  *)
    echo "⚠️  P3 ANOMALY: $ALERT_TYPE"
    echo "   Review at next working day"
    echo "   Run: provana-superpowers:llmops-alert-response for full triage"
    ;;
esac

echo ""

# ── Log the alert ──────────────────────────────────────────────────────────────
ALERT_LOG="docs/llmops/alert-log.md"
mkdir -p "$(dirname "$ALERT_LOG")"
touch "$ALERT_LOG"

{
  echo ""
  echo "## $SEVERITY LLMOps Alert — $TIMESTAMP"
  echo "Type: $ALERT_TYPE | Agent: $AGENT_NAME"
  echo "Status: OPEN — run llmops-alert-response to triage"
  echo "---"
} >> "$ALERT_LOG"

echo "Alert logged to: $ALERT_LOG"
echo ""
echo "Next step: Run 'provana-superpowers:llmops-alert-response' for structured triage."
