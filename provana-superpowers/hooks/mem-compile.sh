#!/usr/bin/env bash
# mem-compile.sh — Session memory compiler
# provana-superpowers v5.1.0
#
# Runs on session Stop. Extracts architectural decisions, patterns, and
# resolved issues from the session and appends them to the project KB.
# Keeps the root CLAUDE.md under 800 tokens by offloading to docs/.
#
# Output files:
#   docs/decisions.md        — appended with new decisions
#   docs/patterns/           — new patterns discovered this session
#   docs/session-log.md      — session summary (what was done, what was deferred)

set -euo pipefail

SESSION_DATE=$(date -u '+%Y-%m-%d')
SESSION_TIME=$(date -u '+%H:%M UTC')
BRANCH=$(git branch --show-current 2>/dev/null || echo 'unknown')
DECISIONS_LOG="docs/decisions.md"
PATTERNS_DIR="docs/patterns"
SESSION_LOG="docs/session-log.md"

echo "=== Memory Compiler ==="
echo "Date: $SESSION_DATE $SESSION_TIME"
echo "Branch: $BRANCH"

# ── Ensure output directories exist ───────────────────────────────────────────
mkdir -p "$PATTERNS_DIR"
touch "$DECISIONS_LOG"
touch "$SESSION_LOG"

# ── Extract decisions from temp files ─────────────────────────────────────────
# During a session, decisions may be staged in /tmp/provana-decisions-*.md
# by the write-provana-plans or mid-sprint-change skills
STAGED_DECISIONS=$(ls /tmp/provana-decisions-*.md 2>/dev/null || true)

if [ -n "$STAGED_DECISIONS" ]; then
  echo ""
  echo "Appending staged decisions to $DECISIONS_LOG..."
  for f in $STAGED_DECISIONS; do
    echo "" >> "$DECISIONS_LOG"
    cat "$f" >> "$DECISIONS_LOG"
    rm "$f"
    echo "  Merged: $f"
  done
fi

# ── Scan for inline decision markers ──────────────────────────────────────────
# The skills write decisions inline in docs/plans/*.md with markers like:
# [DECISION DATE]: ...
# Collect and ensure they're in decisions.md

if [ -d "docs/plans" ]; then
  INLINE_DECISIONS=$(grep -rh "^\[DECISION" docs/plans/ 2>/dev/null | sort -u || true)
  if [ -n "$INLINE_DECISIONS" ]; then
    echo ""
    echo "Found inline decisions in plan files:"
    echo "$INLINE_DECISIONS"
    # Check which are not yet in decisions.md and append
    while IFS= read -r decision; do
      if ! grep -qF "$decision" "$DECISIONS_LOG" 2>/dev/null; then
        echo "$decision" >> "$DECISIONS_LOG"
      fi
    done <<< "$INLINE_DECISIONS"
  fi
fi

# ── CLAUDE.md token check ─────────────────────────────────────────────────────
if [ -f "CLAUDE.md" ]; then
  WORD_COUNT=$(wc -w < "CLAUDE.md")
  echo ""
  echo "CLAUDE.md word count: $WORD_COUNT (target: <600 words / ~800 tokens)"

  if [ "$WORD_COUNT" -gt 600 ]; then
    echo "⚠️  CLAUDE.md is over 600 words. Consider moving sprint-specific content to docs/."
    echo "   Sprint notes → docs/session-log.md"
    echo "   Architecture decisions → docs/decisions.md"
    echo "   Skill patterns → docs/patterns/"
  fi
fi

# ── Write session summary ──────────────────────────────────────────────────────
{
  echo ""
  echo "## Session — $SESSION_DATE $SESSION_TIME"
  echo "Branch: \`$BRANCH\`"
  echo ""

  # Recent git activity as session summary
  if git log --oneline HEAD~5..HEAD 2>/dev/null | grep -q .; then
    echo "### Commits this session"
    git log --oneline HEAD~5..HEAD 2>/dev/null || true
    echo ""
  fi

  # Open plan tasks (unchecked)
  if [ -d "docs/plans" ]; then
    OPEN_TASKS=$(grep -rh "^\- \[ \]" docs/plans/ 2>/dev/null | head -10 || true)
    if [ -n "$OPEN_TASKS" ]; then
      echo "### Open tasks remaining"
      echo "$OPEN_TASKS"
      echo ""
    fi
  fi

  echo "---"
} >> "$SESSION_LOG"

echo ""
echo "✅ Memory compiled"
echo "   Decisions: $DECISIONS_LOG"
echo "   Patterns:  $PATTERNS_DIR/"
echo "   Session:   $SESSION_LOG"
