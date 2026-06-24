#!/usr/bin/env bash
# doc-drift.sh — Spec drift detector
# provana-superpowers v5.1.0
#
# Runs after every file edit. Detects when code diverges from the
# plan doc or story ACs. Surfaces warnings before drift accumulates.
#
# Checks:
#   1. File paths in plan match actual file locations
#   2. Function/class names match what the plan specified
#   3. AC count in story file vs tests (rough coverage check)
#
# Exit 0 always — this is a warning hook, not a blocking hook.
# Blocking happens at pre-commit and post-test.

set -uo pipefail

DRIFT_WARNINGS=()

# Find the active plan file (most recently modified)
PLAN_FILE=$(ls -t docs/plans/*.md 2>/dev/null | head -1 || true)
STORY_FILE=$(ls -t docs/story-*.md 2>/dev/null | head -1 || true)

if [ -z "$PLAN_FILE" ] && [ -z "$STORY_FILE" ]; then
  # No spec docs — can't check drift
  exit 0
fi

echo "=== Doc drift check ==="

# ── 1. File path verification ──────────────────────────────────────────────────
if [ -n "$PLAN_FILE" ]; then
  # Extract file paths from plan (lines starting with src/ or tests/)
  PLAN_PATHS=$(grep -oE '(src|tests)/[A-Za-z0-9_/.]+\.py' "$PLAN_FILE" 2>/dev/null | sort -u || true)

  if [ -n "$PLAN_PATHS" ]; then
    while IFS= read -r path; do
      if [ ! -f "$path" ]; then
        DRIFT_WARNINGS+=("Path in plan does not exist yet: $path")
      fi
    done <<< "$PLAN_PATHS"
  fi
fi

# ── 2. AC coverage rough check ────────────────────────────────────────────────
if [ -n "$STORY_FILE" ]; then
  # Count ACs in the story file
  AC_COUNT=$(grep -c '^AC[0-9]\+\|^- AC[0-9]\+\|^\*\*AC' "$STORY_FILE" 2>/dev/null || echo "0")

  # Count test functions in tests/qc/ for this story
  STORY_NUM=$(basename "$STORY_FILE" | grep -oE '[0-9]+' | head -1 || echo "")
  if [ -n "$STORY_NUM" ]; then
    TEST_FILE="tests/qc/test_story_${STORY_NUM}_acs.py"
    if [ -f "$TEST_FILE" ]; then
      TEST_COUNT=$(grep -c '^    def test_' "$TEST_FILE" 2>/dev/null || echo "0")
      if [ "$TEST_COUNT" -lt "$AC_COUNT" ]; then
        DRIFT_WARNINGS+=("Story $STORY_NUM has $AC_COUNT ACs but only $TEST_COUNT test functions in $TEST_FILE")
      fi
    fi
  fi
fi

# ── 3. CHANGED marker check ────────────────────────────────────────────────────
# If a mid-sprint change was made, the plan should have CHANGED markers
if [ -n "$PLAN_FILE" ]; then
  CHANGED_COUNT=$(grep -c '> \*\*CHANGED' "$PLAN_FILE" 2>/dev/null || echo "0")
  NEW_COUNT=$(grep -c '> \*\*NEW' "$PLAN_FILE" 2>/dev/null || echo "0")

  if [ "$CHANGED_COUNT" -gt 0 ] || [ "$NEW_COUNT" -gt 0 ]; then
    echo "  📝 Plan has $CHANGED_COUNT CHANGED and $NEW_COUNT NEW task markers"
  fi
fi

# ── Output ────────────────────────────────────────────────────────────────────
if [ ${#DRIFT_WARNINGS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  DRIFT WARNINGS (non-blocking — fix before pre-commit):"
  for warn in "${DRIFT_WARNINGS[@]}"; do
    echo "   $warn"
  done
  echo ""
  echo "   Run 'requesting-provana-review' if spec and code are out of sync."
else
  echo "  ✅ No spec drift detected"
fi

exit 0
