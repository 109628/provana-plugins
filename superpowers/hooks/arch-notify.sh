#!/usr/bin/env bash
# arch-notify.sh — Architectural decision notification hook
# provana-superpowers v5.1.0
#
# Fires when Claude detects an architectural decision being made.
# Prompts the developer to log it in docs/decisions.md before continuing.
#
# This is a notification/reminder hook — not a blocking hook.
# The pre-commit hook will flag if decisions.md is out of date.

set -uo pipefail

DECISIONS_LOG="docs/decisions.md"
SESSION_DATE=$(date -u '+%Y-%m-%d')

echo "=== Architectural Decision Detected ==="
echo ""
echo "An architectural decision appears to be in progress."
echo "Provana requires all architectural decisions to be logged in:"
echo "  $DECISIONS_LOG"
echo ""
echo "Decision log format:"
echo "  [$SESSION_DATE] [Context]: [Decision made]. [Why]. [Alternatives considered]. [Trade-offs accepted]."
echo ""
echo "Examples:"
echo "  [$SESSION_DATE] Doc.AI ingest: Using PyMuPDF over pdfplumber for table extraction."
echo "    Reason: 3x faster on multi-column layouts. Trade-off: less robust on scanned docs."
echo ""
echo "  [$SESSION_DATE] Conv.AI persona: Storing persona YAML in src/conv_ai/personas/ not inline."
echo "    Reason: Enables per-client persona overrides without code changes."
echo ""

# Check if decisions.md was recently modified (within the last 30 minutes)
if [ -f "$DECISIONS_LOG" ]; then
  LAST_MODIFIED=$(find "$DECISIONS_LOG" -newer /tmp/arch-notify-last-check -mmin -30 2>/dev/null || true)
  if [ -n "$LAST_MODIFIED" ]; then
    echo "✅ decisions.md was recently updated — looks good."
  else
    echo "⚠️  decisions.md has NOT been updated in the last 30 minutes."
    echo "   Please add an entry before this context is lost."
  fi
fi

# Touch a marker file so we can check recency next time
touch /tmp/arch-notify-last-check 2>/dev/null || true

echo ""
echo "Skill reference: The writing-provana-plans skill includes a decisions.md template."
