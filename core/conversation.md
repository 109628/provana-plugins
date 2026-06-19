# provana-core v1.0.0 — Design Decisions

## Status & location

**Published:** https://github.com/109628/provana-core  
**Install:** `proctl add 109628/provana-core`  
**Local copy:** `provana-plugins/plugins/provana-core/`  
**E2E tested:** 2026-06-18 — install, list, remove all verified clean  

For full project context read: `../../scratchpad/conversation.md`

## Why git-workflow and api-design were chosen first

These two skills cover the highest-frequency decisions engineers make daily at Provana:

- **git-workflow**: Every commit, branch, and PR touches this. Without a shared standard,
  commit history becomes noise and PR reviews get bogged down in formatting debates.
  The Conventional Commits format also enables automated changelog generation and
  semantic versioning later.

- **api-design**: Provana builds service-to-service APIs and customer-facing REST APIs.
  A shared error envelope and `requestId` convention is foundational for distributed
  tracing and consistent client error handling across teams.

Both skills are documentation-only (SKILL.md files), not executable code, which means
they can be updated without breaking anything and are safe to iterate on rapidly.

## Hook design decisions

### Which patterns to block

The dangerous-bash-guard blocks commands where the blast radius of a mistake is
high and the correct path is to pause and confirm:

- `rm -rf` / `rm -r`: Irrecoverable file deletion. Claude can suggest safer alternatives.
- `git reset --hard`: Discards uncommitted work permanently.
- `git clean -f`: Deletes untracked files — common trap when cleaning build artifacts.
- `DROP TABLE` / `DROP DATABASE`: DDL drops are irreversible in most production DBs.
- `format c:` / `del /s`: Windows-native destructive equivalents.
- `kubectl delete` without `--namespace`: Namespace-scoped deletes are recoverable;
  cluster-wide deletes are not. Requiring `-n` forces the engineer to be explicit.

### Why async: false

The hook must block command execution until a decision is made. With `async: true`,
Claude would proceed while the hook evaluates — defeating the purpose. Synchronous
execution adds a small latency cost per Bash call, but that's the correct trade-off
for a safety guardrail.

### Fail-open policy

If the hook receives malformed input or a JSON parse error, it exits 0 without blocking.
A broken guardrail that prevents ALL commands is worse than a temporarily absent guard.
Errors in the hook itself are logged but never cause false blocks.

## What is intentionally NOT in v1.0.0

- **Language-specific skills** (Python style, TypeScript conventions): These belong in
  per-language or per-project plugins. Core should stay language-agnostic.

- **Docker/CI skills**: Covered by the `/docker-setup` skill already shipped in the
  global Claude config. No need to duplicate.

- **Agent delegation rules**: Those live in CLAUDE.md project files, not a shared plugin,
  because they vary by team and project maturity.

- **Linting/formatting hooks**: Too project-specific to be useful in a core plugin.
  Teams should configure these in their own repo's `.claude/settings.json`.

- **Database migration guards**: A future `provana-data` plugin will cover this, including
  `alembic` workflow standards and migration review checklists.

- **Secret scanning**: Will be a dedicated `provana-security` plugin that wraps `gitleaks`
  or `truffleHog` as a PreToolUse hook on file writes.
