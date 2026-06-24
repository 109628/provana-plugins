#!/usr/bin/env bash
# pre-commit.sh — Provana pre-commit safety gate
# provana-superpowers v5.1.0
#
# Runs before every git commit. Blocks commits that violate Provana's
# TDD discipline, contain debug artifacts, or have failing tests.
#
# Exit 0 = allow commit
# Exit 1 = block commit

set -euo pipefail

PASS=0
FAIL=0
WARNINGS=()
ERRORS=()

echo "=== Provana pre-commit gate ==="

# ── 1. Secrets check ──────────────────────────────────────────────────────────
echo "[1/5] Checking for secrets..."

# Check staged files for common secret patterns
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -n "$STAGED_FILES" ]; then
  SECRET_PATTERNS=(
    'AZURE_.*=.*[A-Za-z0-9+/]{20,}'
    'api[_-]?key.*=.*[A-Za-z0-9+/]{16,}'
    'password.*=.*[A-Za-z0-9+/!@#$%^&*]{8,}'
    'secret.*=.*[A-Za-z0-9+/]{16,}'
    'token.*=.*[A-Za-z0-9+/._-]{20,}'
    'BEGIN.*PRIVATE KEY'
    'OPENAI_API_KEY'
    'ANTHROPIC_API_KEY'
  )

  for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$STAGED_FILES" | xargs grep -rEil "$pattern" 2>/dev/null | grep -v '.env.example' | grep -v 'hooks/' | grep -q .; then
      ERRORS+=("CRITICAL: Potential secret found matching pattern: $pattern")
      FAIL=1
    fi
  done
fi

[ $FAIL -eq 0 ] && echo "  ✅ No secrets detected" || echo "  ❌ Secret patterns found — see errors below"

# ── 2. Debug artifact check ───────────────────────────────────────────────────
echo "[2/5] Checking for debug artifacts..."

DEBUG_PATTERNS=('^\s*print(' '^\s*# TODO' '^\s*# FIXME' 'import pdb' 'pdb.set_trace' 'breakpoint()')
DEBUG_FOUND=0

if [ -n "$STAGED_FILES" ]; then
  for pattern in "${DEBUG_PATTERNS[@]}"; do
    MATCHES=$(echo "$STAGED_FILES" | xargs grep -rn "$pattern" 2>/dev/null | grep -v 'test_' | grep -v '.md' || true)
    if [ -n "$MATCHES" ]; then
      WARNINGS+=("IMPORTANT: Debug artifact found: $pattern")
      DEBUG_FOUND=1
    fi
  done
fi

[ $DEBUG_FOUND -eq 0 ] && echo "  ✅ No debug artifacts" || echo "  ⚠️  Debug artifacts found — see warnings"

# ── 3. TDD discipline check ───────────────────────────────────────────────────
echo "[3/5] Checking TDD discipline..."

# If Python source files are staged, corresponding test files must also be staged
PY_SRC_STAGED=$(echo "$STAGED_FILES" | grep '^src/' | grep '\.py$' | grep -v '__init__' || true)

if [ -n "$PY_SRC_STAGED" ]; then
  while IFS= read -r src_file; do
    # Derive expected test path: src/pod/module.py → tests/pod/test_module.py
    test_path=$(echo "$src_file" | sed 's|^src/|tests/|' | sed 's|/\([^/]*\)\.py$|/test_\1.py|')

    if ! echo "$STAGED_FILES" | grep -q "$test_path"; then
      # Test file might exist but not be staged — check if it exists
      if [ ! -f "$test_path" ]; then
        ERRORS+=("CRITICAL: No test file for $src_file — expected $test_path (TDD requires RED before GREEN)")
        FAIL=1
      else
        WARNINGS+=("IMPORTANT: Test file $test_path exists but is not staged alongside $src_file")
      fi
    fi
  done <<< "$PY_SRC_STAGED"
fi

[ $FAIL -eq 0 ] && echo "  ✅ TDD discipline check passed" || echo "  ❌ TDD violations found"

# ── 4. Test suite must pass ───────────────────────────────────────────────────
echo "[4/5] Running test suite..."

if command -v pytest &>/dev/null; then
  if ! pytest tests/ -q --tb=no 2>/dev/null; then
    ERRORS+=("CRITICAL: Test suite failing — fix tests before committing")
    FAIL=1
    echo "  ❌ Tests failing"
  else
    echo "  ✅ All tests pass"
  fi
else
  WARNINGS+=("IMPORTANT: pytest not found — skipping test check")
  echo "  ⚠️  pytest not available"
fi

# ── 5. Commit message format check ───────────────────────────────────────────
echo "[5/5] Commit message format..."

# Read the commit message file if available
COMMIT_MSG_FILE="${1:-}"
if [ -n "$COMMIT_MSG_FILE" ] && [ -f "$COMMIT_MSG_FILE" ]; then
  COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
  # Provana format: [type]([pod-scope]): [description]
  if ! echo "$COMMIT_MSG" | grep -qE '^\[(feat|fix|test|refactor|chore|docs|perf)\]\([a-z_]+\): .+'; then
    WARNINGS+=("IMPORTANT: Commit message doesn't follow Provana format: [type]([pod-scope]): [description]")
  else
    echo "  ✅ Commit message format valid"
  fi
else
  echo "  ⏭  No commit message file to check"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Pre-commit summary ==="

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "❌ BLOCKING ERRORS:"
  for err in "${ERRORS[@]}"; do
    echo "   $err"
  done
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "⚠️  WARNINGS (non-blocking):"
  for warn in "${WARNINGS[@]}"; do
    echo "   $warn"
  done
fi

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "❌ Commit BLOCKED. Fix the errors above before committing."
  echo "   Run: pytest tests/ -v   to see full test failures"
  exit 1
fi

echo ""
echo "✅ All pre-commit checks passed. Commit allowed."
exit 0
