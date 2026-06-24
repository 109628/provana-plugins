#!/usr/bin/env bash
# sre-runbook-gen.sh — Auto-generate SRE runbook stub on production alerts
# provana-superpowers v5.1.0
#
# Invoked when a production alert fires. Generates a timestamped runbook
# stub pre-filled with the alert context, then triggers agentic-sre-runbook.
#
# Usage:
#   hooks/sre-runbook-gen.sh --service [name] --severity [P0|P1|P2|P3] --description "[desc]"
#   Called automatically by settings.json Notification hook on production alerts.

set -uo pipefail

SERVICE="${SERVICE:-unknown}"
SEVERITY="${SEVERITY:-P2}"
DESCRIPTION="${DESCRIPTION:-Production alert fired}"
INCIDENT_ID="INC-$(date -u '+%Y%m%d-%H%M')"
RUNBOOK_DIR="docs/postmortems"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --severity) SEVERITY="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p "$RUNBOOK_DIR"

RUNBOOK_FILE="$RUNBOOK_DIR/${INCIDENT_ID}-${SERVICE}.md"

echo "=== SRE Runbook Generator ==="
echo "Incident: $INCIDENT_ID"
echo "Service: $SERVICE"
echo "Severity: $SEVERITY"
echo ""

cat > "$RUNBOOK_FILE" << RUNBOOK
# Incident Runbook — $INCIDENT_ID — $SERVICE

**Generated:** $TIMESTAMP
**Severity:** $SEVERITY
**Service:** $SERVICE
**Description:** $DESCRIPTION

## Status: INVESTIGATING

## Incident Update — $SEVERITY — $SERVICE
**Time:** $TIMESTAMP
**Status:** Investigating

**Impact:** [Fill in: what users/operations are affected]

**Timeline:**
- $TIMESTAMP: Alert fired — $DESCRIPTION
- [time]: Root cause identified
- [time]: Fix applied

**Current action:** Running agentic-sre-runbook 4-phase RCA
**ETA:** Under investigation

**Contact:** [Agentic SRE lead]

---

## Phase 1: Reproduce

[ ] Pull logs for the last hour
[ ] Identify exact failing input/output
[ ] Determine: consistent or intermittent?

\`\`\`bash
# Pull logs
az monitor log-analytics query \\
  --workspace [workspace-id] \\
  --analytics-query "
    traces
    | where timestamp > ago(1h)
    | where customDimensions.service == '$SERVICE'
    | where severityLevel >= 2
    | order by timestamp desc
    | take 100
  "
\`\`\`

**Exact input:** [fill in]
**Exact output:** [fill in]
**Timestamp range:** [fill in]
**Consistent/intermittent:** [fill in]

---

## Phase 2: Isolate

[ ] Determine fault domain

For Conv.AI: Is it STT, LLM, or TTS?
For Doc.AI: Is it ingest, parse, extract, or store?
For BPM: Is it SOP lookup, rule engine, or judgment escalation?

**Fault domain:** [fill in]

---

## Phase 3: Diagnose

[ ] Check recent deployments (last 24h)
[ ] Check prompt version log
[ ] Check model version
[ ] Check context window size

**Root cause:** [fill in — precise, evidence-based]

---

## Phase 4: Fix

[ ] Fix applied
[ ] Tested on staging
[ ] Deployed to production
[ ] Monitoring confirms resolution

**Fix:** [fill in]

---

## Postmortem (fill in after resolution)

### Summary
[2-3 sentences: what happened, how it was fixed]

### Root cause
[Technical root cause — precise, no blame]

### Contributing factors
[What made this incident possible]

### Impact
[Quantified: users affected, duration, SLO delta]

### Action items
| Item | Owner | Due date | Priority |
|------|-------|----------|---------|
| [item] | [owner] | [date] | P[N] |

### What went well
[Things that helped contain or resolve the incident]
RUNBOOK

echo "✅ Runbook stub created: $RUNBOOK_FILE"
echo ""
echo "Next step: Run 'provana-superpowers:agentic-sre-runbook' to begin 4-phase RCA."
echo "           Fill in Phase 1 reproduction steps immediately."
