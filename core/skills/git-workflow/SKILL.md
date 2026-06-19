---
name: git-workflow
description: >
  Conventional commits, Provana branch naming, PR descriptions. Use when committing,
  creating branches, writing PR descriptions, or reviewing git workflow.
---

# Git Workflow — Provana Standards

## Commit Format

```
type(scope): subject (≤50 chars)

body (optional — only when WHY is non-obvious)
```

### Commit Types

| Type | When to use |
|------|-------------|
| `feat` | New user-facing feature or capability |
| `fix` | Bug fix that corrects incorrect behavior |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or updating tests only |
| `docs` | Documentation changes only |
| `chore` | Dependency bumps, config updates, tooling |
| `perf` | Performance improvement with measurable impact |
| `ci` | CI/CD pipeline changes |

### Rules

- Subject line: imperative mood, no period, ≤50 chars
- Scope: the module/package affected (optional but recommended)
- Body: only when the WHY is non-obvious — skip it otherwise
- NEVER use `--no-verify` — if a hook fails, fix the root cause
- NEVER amend published commits — create a new one

### Examples

```
feat(auth): add JWT refresh token rotation
fix(api): return 422 on missing required fields
refactor(db): extract connection pool to singleton
chore: bump ruff to 0.4.2
perf(search): add compound index on (org_id, created_at)
```

## Branch Naming

```
type/TICKET-ID-short-description
```

- Use the same type prefixes as commits
- Ticket ID is mandatory when one exists (e.g. `PROV-123`)
- Description: lowercase, hyphens, ≤4 words
- No slashes inside the description segment

### Examples

```
feat/PROV-123-add-auth
fix/PROV-456-null-pointer-login
refactor/PROV-789-extract-db-layer
chore/bump-dependencies
```

## PR Title

Same format as the commit subject line:

```
type(scope): subject (≤50 chars)
```

## PR Description Template

```markdown
## Summary
- <bullet: what changed and why>
- <bullet: any non-obvious design choice>

## Test plan
- [ ] Unit tests pass (`pytest`)
- [ ] Manual: <describe the golden path you tested>
- [ ] Edge case: <what failure scenario you verified>

## Screenshots
<!-- include for any UI changes -->
```

### PR Rules

- Link the Linear/Jira ticket in the summary when one exists
- Mark as Draft until CI is green and self-review is done
- Squash-merge preferred; rebase only when history needs to be clean
- Delete the branch after merge

## What to Avoid

- Generic subjects: `fix stuff`, `update code`, `WIP`
- Mixing unrelated changes in one commit
- Skipping the test plan section on PRs
- Force-pushing to shared branches (`main`, `develop`, release branches)
