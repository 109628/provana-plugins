#!/usr/bin/env bash
# injection-detector.sh — Prompt injection detection hook
# provana-superpowers v5.1.0
#
# Runs before every Bash tool use. Detects prompt injection patterns
# in file content that would be passed to an LLM. Particularly important
# for Doc.AI pipelines where documents may contain adversarial instructions.
#
# This is a warning hook for development. Production injection detection
# is implemented in src/qc/injection_detector.py (InjectionDetector class).
#
# Exit 0 = allow (with warnings)
# Exit 1 = block only if injection in code/config being committed

set -uo pipefail

WARNINGS=()

# ── Injection patterns to detect in recently modified files ───────────────────
INJECTION_PATTERNS=(
  'ignore previous instructions'
  'ignore all previous'
  'disregard the above'
  'forget your instructions'
  'you are now'
  'pretend you are'
  'act as if'
  'system prompt:'
  '\[INST\]'
  '\[SYSTEM\]'
  'Human:\s*ignore'
  'Assistant:\s*ignore'
)

# Check recently modified files that will be processed by the LLM pipeline
PIPELINE_FILES=$(find . \( -name "*.txt" -o -name "*.md" -o -name "*.yaml" -o -name "*.json" \) \
  -newer /tmp/injection-scan-last-run \
  -not -path "./.git/*" \
  -not -path "./docs/*" \
  -not -path "./hooks/*" \
  2>/dev/null | head -20 || true)

if [ -n "$PIPELINE_FILES" ]; then
  for pattern in "${INJECTION_PATTERNS[@]}"; do
    MATCHES=$(echo "$PIPELINE_FILES" | xargs grep -liE "$pattern" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      WARNINGS+=("Potential injection pattern '$pattern' in: $MATCHES")
    fi
  done
fi

# ── Check test fixtures for injection (these should be intentional) ─────────────
TEST_INJECTIONS=$(find tests/ -name "*.txt" -o -name "*.json" 2>/dev/null | \
  xargs grep -liE "ignore previous instructions|ignore all previous" 2>/dev/null || true)

if [ -n "$TEST_INJECTIONS" ]; then
  # Test fixtures with injection patterns are expected — they're adversarial test cases
  echo "ℹ️  Injection test fixtures found (expected): $TEST_INJECTIONS"
fi

touch /tmp/injection-scan-last-run 2>/dev/null || true

# ── Output ────────────────────────────────────────────────────────────────────
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "=== Injection Detector ==="
  echo "⚠️  Potential prompt injection patterns detected:"
  for warn in "${WARNINGS[@]}"; do
    echo "  $warn"
  done
  echo ""
  echo "If these are adversarial test fixtures, move them to tests/fixtures/adversarial/"
  echo "If these are in real document inputs, ensure InjectionDetector runs before LLM calls."
  echo ""
  echo "Production injection detection: src/qc/injection_detector.py"
fi

exit 0
