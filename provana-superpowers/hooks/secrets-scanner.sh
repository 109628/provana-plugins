#!/usr/bin/env bash
# secrets-scanner.sh — Pre-tool-use secret detection
# provana-superpowers v5.1.0
#
# Runs before every Bash tool use. Scans the command being executed
# for patterns that would expose secrets (env var echoes, credential files, etc.)
#
# Also scans recently modified files for accidental secret inclusion.
#
# Exit 0 = allow
# Exit 1 = block (only for explicit secret exposure commands)

set -uo pipefail

COMMAND="${BASH_COMMAND:-}"
WARNINGS=()
BLOCKED=false

# ── 1. Dangerous command patterns ─────────────────────────────────────────────
DANGEROUS_PATTERNS=(
  'echo.*API_KEY'
  'echo.*SECRET'
  'echo.*PASSWORD'
  'echo.*TOKEN'
  'cat.*\.env'
  'cat.*credentials'
  'cat.*secrets'
  'print.*api_key'
  'print.*secret'
  'git add.*\.env'
  'git add.*credentials'
)

if [ -n "$COMMAND" ]; then
  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
      WARNINGS+=("Command may expose secrets: matches pattern '$pattern'")
      BLOCKED=true
    fi
  done
fi

# ── 2. Scan recently modified Python/YAML files ────────────────────────────────
RECENT_FILES=$(find . -name "*.py" -newer /tmp/secrets-scan-last-run -not -path "./.git/*" -not -path "./hooks/*" 2>/dev/null | head -20 || true)

SECRET_CODE_PATTERNS=(
  'api_key\s*=\s*["\x27][A-Za-z0-9+/]{16,}'
  'password\s*=\s*["\x27][A-Za-z0-9!@#$%^&*]{8,}'
  'secret\s*=\s*["\x27][A-Za-z0-9+/]{16,}'
  'AZURE_.*=.*["\x27][A-Za-z0-9+/]{20,}'
)

if [ -n "$RECENT_FILES" ]; then
  for pattern in "${SECRET_CODE_PATTERNS[@]}"; do
    MATCHES=$(echo "$RECENT_FILES" | xargs grep -lE "$pattern" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      WARNINGS+=("Potential hardcoded secret in: $MATCHES (pattern: $pattern)")
      # Don't block on this — could be false positive. Log and warn.
    fi
  done
fi

touch /tmp/secrets-scan-last-run 2>/dev/null || true

# ── Output ────────────────────────────────────────────────────────────────────
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "=== Secrets Scanner ==="
  for warn in "${WARNINGS[@]}"; do
    echo "  ⚠️  $warn"
  done
  echo ""
fi

if [ "$BLOCKED" = true ]; then
  echo "❌ BLOCKED: Command may expose secrets. Use environment variables instead."
  echo "   Load secrets via: source .env (and ensure .env is in .gitignore)"
  exit 1
fi

exit 0
