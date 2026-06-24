#!/usr/bin/env bash
# skill-router.sh — Adaptive skill context router
# provana-superpowers v1.1.0
#
# Runs at session start and after significant tool use.
# Classifies the current work domain, determines which skills are relevant,
# and writes routing recommendations to /tmp/provana-skill-route.md
# for Claude to read and act on.
#
# This script does NOT load skills — it produces a routing recommendation.
# Claude reads the recommendation and decides what to load/evict.
#
# Exit 0 always — router is advisory, never blocking.

set -uo pipefail

SESSION_STATE="/tmp/provana-session-state.json"
ROUTE_FILE="/tmp/provana-skill-route.md"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
SESSION_ID="${PROVANA_SESSION_ID:-$(date -u '+%Y%m%d%H%M%S')}"

# ── Detect project context ─────────────────────────────────────────────────────

# Detect pod type from project structure
POD_TYPE="unknown"
if [ -d "src/conv_ai" ] || [ -d "src/conv-ai" ]; then
  POD_TYPE="conv_ai"
elif [ -d "src/doc_ai" ] || [ -d "src/doc-ai" ]; then
  POD_TYPE="doc_ai"
elif [ -d "src/bpm" ]; then
  POD_TYPE="bpm"
fi

# Detect current phase from git branch name and file activity
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
SESSION_PHASE="unknown"

if echo "$BRANCH" | grep -qiE "discovery|spec|prd|feature|story"; then
  SESSION_PHASE="discovery"
elif echo "$BRANCH" | grep -qiE "plan|arch|design"; then
  SESSION_PHASE="architecture"
elif echo "$BRANCH" | grep -qiE "feat|fix|build|impl|dev"; then
  SESSION_PHASE="build"
elif echo "$BRANCH" | grep -qiE "qc|qa|review|test"; then
  SESSION_PHASE="qc"
elif echo "$BRANCH" | grep -qiE "hotfix|incident|sre|ops"; then
  SESSION_PHASE="ops"
elif echo "$BRANCH" | grep -qiE "mid-sprint|change|pivot"; then
  SESSION_PHASE="mid-sprint"
fi

# If phase still unknown, infer from file activity
if [ "$SESSION_PHASE" = "unknown" ]; then
  if [ -f "docs/PRD.md" ] && [ ! -d "src" ]; then
    SESSION_PHASE="discovery"
  elif ls docs/plans/*.md 2>/dev/null | grep -q .; then
    SESSION_PHASE="build"
  elif ls reviews/review-*.md 2>/dev/null | grep -q .; then
    SESSION_PHASE="qc"
  else
    SESSION_PHASE="build"  # Default to build if nothing else matches
  fi
fi

# ── Detect domain signals (non-Provana projects) ──────────────────────────────

DOMAIN_SIGNALS=""

# Azure signals
if grep -rqiE "event.hub|event.grid|service.bus|azure.functions|cosmos.db|azure.ai.search" \
   src/ docs/ CLAUDE.md 2>/dev/null; then
  DOMAIN_SIGNALS="$DOMAIN_SIGNALS azure"
fi

# Vector/RAG signals
if grep -rqiE "vector|embedding|mongodb.atlas|rag|retrieval|pgvector|pinecone|weaviate|semantic.search" \
   src/ docs/ CLAUDE.md 2>/dev/null; then
  DOMAIN_SIGNALS="$DOMAIN_SIGNALS vector"
fi

# Event-driven signals
if grep -rqiE "event.sourcing|cqrs|saga|outbox|pub.?sub|message.queue|kafka|competing.consumer" \
   src/ docs/ CLAUDE.md 2>/dev/null; then
  DOMAIN_SIGNALS="$DOMAIN_SIGNALS events"
fi

# ── Compute recommended skill set ─────────────────────────────────────────────

ALWAYS_AVAILABLE="provana-bootstrap"
RECOMMENDED_HOT=""
RECOMMENDED_WARM=""
RECOMMENDED_COLD=""

case "$SESSION_PHASE" in
  discovery)
    RECOMMENDED_HOT="bmad-discovery"
    [ "$POD_TYPE" = "bpm" ] && RECOMMENDED_HOT="$RECOMMENDED_HOT bpm-discovery"
    # project-init is hot on fresh repos (no src/ dir yet)
    [ ! -d "src" ] && RECOMMENDED_HOT="$RECOMMENDED_HOT project-init"
    RECOMMENDED_WARM="writing-provana-plans parallel-build"
    RECOMMENDED_COLD="provana-tdd subagent-driven-delivery agent-qc-harness requesting-provana-review mid-sprint-change finishing-provana-branch agentic-sre-runbook llmops-alert-response conv-ai-scaffold doc-pipeline-scaffold azure-cicd"
    ;;
  architecture)
    RECOMMENDED_HOT="writing-provana-plans"
    echo "$DOMAIN_SIGNALS" | grep -q "azure" && RECOMMENDED_HOT="$RECOMMENDED_HOT azure-cloud-design azure-deployment"
    echo "$DOMAIN_SIGNALS" | grep -q "vector" && RECOMMENDED_HOT="$RECOMMENDED_HOT vector-db-design"
    echo "$DOMAIN_SIGNALS" | grep -q "events" && RECOMMENDED_HOT="$RECOMMENDED_HOT event-driven-design"
    RECOMMENDED_WARM="bmad-discovery subagent-driven-delivery"
    RECOMMENDED_COLD="provana-tdd agent-qc-harness requesting-provana-review mid-sprint-change finishing-provana-branch agentic-sre-runbook llmops-alert-response"
    ;;
  build)
    RECOMMENDED_HOT="provana-tdd subagent-driven-delivery"
    case "$POD_TYPE" in
      conv_ai) RECOMMENDED_HOT="$RECOMMENDED_HOT conv-ai-scaffold"
               RECOMMENDED_WARM="$RECOMMENDED_WARM voice-pipeline-eval" ;;
      doc_ai)  RECOMMENDED_HOT="$RECOMMENDED_HOT doc-pipeline-scaffold"
               RECOMMENDED_WARM="$RECOMMENDED_WARM qa-automation" ;;
      bpm)     RECOMMENDED_WARM="$RECOMMENDED_WARM bpm-discovery qa-automation" ;;
    esac
    echo "$DOMAIN_SIGNALS" | grep -q "azure" && RECOMMENDED_WARM="$RECOMMENDED_WARM azure-cloud-design"
    echo "$DOMAIN_SIGNALS" | grep -q "vector" && RECOMMENDED_WARM="$RECOMMENDED_WARM vector-db-design"
    RECOMMENDED_WARM="$RECOMMENDED_WARM writing-provana-plans agent-qc-harness parallel-build azure-cicd"
    RECOMMENDED_COLD="bmad-discovery finishing-provana-branch agentic-sre-runbook llmops-alert-response project-init"
    ;;
  qc)
    RECOMMENDED_HOT="agent-qc-harness requesting-provana-review"
    # Add qa-automation for UI/web projects, voice-pipeline-eval for Conv.AI
    [ "$POD_TYPE" = "conv_ai" ] && RECOMMENDED_HOT="$RECOMMENDED_HOT voice-pipeline-eval"
    [ "$POD_TYPE" != "conv_ai" ] && RECOMMENDED_WARM="qa-automation $RECOMMENDED_WARM"
    [ "$POD_TYPE" = "conv_ai" ] && RECOMMENDED_WARM="qa-automation $RECOMMENDED_WARM"
    RECOMMENDED_WARM="$RECOMMENDED_WARM provana-tdd mid-sprint-change"
    RECOMMENDED_COLD="bmad-discovery writing-provana-plans subagent-driven-delivery conv-ai-scaffold doc-pipeline-scaffold bpm-discovery finishing-provana-branch agentic-sre-runbook llmops-alert-response"
    ;;
  ops)
    RECOMMENDED_HOT="agentic-sre-runbook llmops-alert-response"
    RECOMMENDED_WARM="agent-qc-harness"
    RECOMMENDED_COLD="bmad-discovery writing-provana-plans subagent-driven-delivery provana-tdd conv-ai-scaffold doc-pipeline-scaffold bpm-discovery mid-sprint-change requesting-provana-review finishing-provana-branch"
    ;;
  mid-sprint)
    RECOMMENDED_HOT="mid-sprint-change"
    RECOMMENDED_WARM="writing-provana-plans provana-tdd agent-qc-harness"
    RECOMMENDED_COLD="bmad-discovery subagent-driven-delivery conv-ai-scaffold doc-pipeline-scaffold bpm-discovery finishing-provana-branch agentic-sre-runbook llmops-alert-response"
    ;;
  *)
    # General / unknown — load minimal set
    RECOMMENDED_HOT=""
    RECOMMENDED_WARM="bmad-discovery writing-provana-plans provana-tdd agent-qc-harness"
    echo "$DOMAIN_SIGNALS" | grep -q "azure" && RECOMMENDED_WARM="$RECOMMENDED_WARM azure-cloud-design"
    echo "$DOMAIN_SIGNALS" | grep -q "vector" && RECOMMENDED_WARM="$RECOMMENDED_WARM vector-db-design"
    echo "$DOMAIN_SIGNALS" | grep -q "events" && RECOMMENDED_WARM="$RECOMMENDED_WARM event-driven-design"
    RECOMMENDED_COLD="conv-ai-scaffold doc-pipeline-scaffold bpm-discovery mid-sprint-change requesting-provana-review finishing-provana-branch agentic-sre-runbook llmops-alert-response"
    ;;
esac

# These are always warm — available but not loaded by default
RECOMMENDED_WARM="$RECOMMENDED_WARM tool-forge context-manager"
# parallel-build, azure-cicd, and team-collaboration are always warm
echo "$RECOMMENDED_WARM" | grep -q "parallel-build" || RECOMMENDED_WARM="$RECOMMENDED_WARM parallel-build"
echo "$RECOMMENDED_WARM" | grep -q "azure-cicd" || RECOMMENDED_WARM="$RECOMMENDED_WARM azure-cicd"
echo "$RECOMMENDED_WARM" | grep -q "team-collaboration" || RECOMMENDED_WARM="$RECOMMENDED_WARM team-collaboration"

# ── Write session state ────────────────────────────────────────────────────────
cat > "$SESSION_STATE" << EOF
{
  "sessionId": "$SESSION_ID",
  "timestamp": "$TIMESTAMP",
  "detectedPhase": "$SESSION_PHASE",
  "detectedPod": "$POD_TYPE",
  "domainSignals": "$DOMAIN_SIGNALS",
  "branch": "$BRANCH",
  "recommendedHot": "$RECOMMENDED_HOT",
  "recommendedWarm": "$RECOMMENDED_WARM",
  "tokenBudgetUsed": 0,
  "tokenBudgetLimit": 4000
}
EOF

# ── Write routing recommendation for Claude ───────────────────────────────────
cat > "$ROUTE_FILE" << EOF
# Skill Router — Context Recommendation
Generated: $TIMESTAMP
Session phase: $SESSION_PHASE
Pod type: $POD_TYPE
Domain signals: ${DOMAIN_SIGNALS:-none}
Branch: $BRANCH

## Recommended context load

### Hot (load full SKILL.md now)
$(for skill in $RECOMMENDED_HOT; do echo "- provana-superpowers:$skill"; done)
$([ -z "$RECOMMENDED_HOT" ] && echo "- (none — minimal session)")

### Warm (hold as one-liner summary, load on first trigger)
$(for skill in $RECOMMENDED_WARM; do echo "- provana-superpowers:$skill"; done)

### Cold (do not load — available on explicit invocation only)
$(for skill in $RECOMMENDED_COLD; do echo "- provana-superpowers:$skill"; done)

## Token estimate
Hot skills (~600 tokens each):   $(echo $RECOMMENDED_HOT | wc -w) × 600 = $(( $(echo $RECOMMENDED_HOT | wc -w) * 600 )) tokens
Warm skills (~15 tokens each):   $(echo $RECOMMENDED_WARM | wc -w) × 15  = $(( $(echo $RECOMMENDED_WARM | wc -w) * 15 )) tokens
Root CLAUDE.md:                  ~350 tokens
Total estimated context for skills: ~$(( $(echo $RECOMMENDED_HOT | wc -w) * 600 + $(echo $RECOMMENDED_WARM | wc -w) * 15 + 350 )) tokens

## Routing note
If the user's next message signals a domain not covered by the hot set,
promote the matching warm skill to hot and evict the least-recently-used hot skill.
EOF

echo "=== Skill Router ==="
echo "Phase: $SESSION_PHASE | Pod: $POD_TYPE | Signals: ${DOMAIN_SIGNALS:-none}"
echo "Hot: ${RECOMMENDED_HOT:-none}"
echo "Warm: $RECOMMENDED_WARM"
echo "Routing recommendation written to: $ROUTE_FILE"
echo ""
echo "Claude: read $ROUTE_FILE and run context-manager to apply."

exit 0
