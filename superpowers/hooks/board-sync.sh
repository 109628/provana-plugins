#!/usr/bin/env bash
# board-sync.sh — Azure Board sync hook
# provana-superpowers v5.1.0
#
# Syncs task statuses between the local session and Azure Boards.
# Called on session Stop and optionally mid-session via MCP.
#
# Usage:
#   hooks/board-sync.sh                    # Sync current session state
#   hooks/board-sync.sh --close-sprint N   # Close sprint N items
#   hooks/board-sync.sh --story NNN        # Sync specific story
#
# Requires: Azure DevOps MCP server connected (mcp__azure-devops)
# Config: Set AZURE_ORG, AZURE_PROJECT in project .env (not committed)

set -euo pipefail

AZURE_ORG="${AZURE_ORG:-}"
AZURE_PROJECT="${AZURE_PROJECT:-}"
DECISIONS_LOG="docs/decisions.md"
MODE="sync"
STORY=""
SPRINT=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --close-sprint) SPRINT="$2"; MODE="close-sprint"; shift 2 ;;
    --story) STORY="$2"; MODE="story"; shift 2 ;;
    *) shift ;;
  esac
done

echo "=== Azure Board Sync ==="
echo "Date: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "Mode: $MODE"

# ── Config check ──────────────────────────────────────────────────────────────
if [ -z "$AZURE_ORG" ] || [ -z "$AZURE_PROJECT" ]; then
  echo "⚠️  AZURE_ORG or AZURE_PROJECT not set."
  echo "   Set these in your project .env file (not committed to git)."
  echo "   Board sync skipped."
  exit 0
fi

# ── Read docs/decisions.md for pending board items ────────────────────────────
if [ -f "$DECISIONS_LOG" ]; then
  # Extract Azure Board ticket references from decisions log
  PENDING_TICKETS=$(grep -oE 'AB#[0-9]+' "$DECISIONS_LOG" | sort -u || true)
  echo "Found board references in decisions log: ${PENDING_TICKETS:-none}"
fi

# ── Log the sync intent (MCP would execute the actual API calls) ───────────────
cat << EOF

Board sync actions to execute via Azure DevOps MCP:

$(if [ "$MODE" = "close-sprint" ] && [ -n "$SPRINT" ]; then
echo "  - Close sprint $SPRINT: mark all 'Ready for Review' items as Done"
echo "  - Update sprint velocity metrics"
fi)

$(if [ "$MODE" = "story" ] && [ -n "$STORY" ]; then
echo "  - Sync story $STORY status from docs/story-${STORY}.md"
fi)

$(if [ "$MODE" = "sync" ]; then
echo "  - Read docs/plans/*.md for checked-off tasks → mark Azure Board items In Progress or Done"
echo "  - Read docs/decisions.md for deferred items → create Azure Board tasks if none exist"
echo "  - Sync story statuses based on current branch state"
fi)

NOTE: Actual Azure Board writes require the Azure DevOps MCP server.
      If not connected, log these actions and run manually.
EOF

# ── Write sync log ─────────────────────────────────────────────────────────────
SYNC_LOG="docs/board-sync-log.md"
{
  echo ""
  echo "## Board Sync — $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo "Mode: $MODE"
  echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
  if [ -n "$PENDING_TICKETS" ]; then
    echo "Tickets referenced: $PENDING_TICKETS"
  fi
} >> "$SYNC_LOG" 2>/dev/null || true

echo ""
echo "✅ Board sync complete (or logged for manual execution)"
echo "   See $SYNC_LOG for history"
