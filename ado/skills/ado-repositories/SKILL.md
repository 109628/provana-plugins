---
name: ado-repositories
description: >
  Azure DevOps repos — PR creation, branch policies, code review workflow, Provana
  branching conventions. Use when creating PRs, reviewing code, pushing branches,
  or working with ADO Git repositories in the provanadev organization.
---

# Azure DevOps Repositories

MCP tools available after `provana-ado` plugin is installed. Uses the `azure_devops`
MCP server (org: `provanadev`).

## Available MCP Tools

### List Repositories
```
List all repos in project "core"
```

### Create Pull Request
```
Create a PR in repo "ccai-services" from branch "feat/PROV-123-add-auth"
to "main", title "feat(auth): add token refresh mechanism", link work item #4521
```

### Get PR Status
```
Show open PRs assigned to me for review in project "core"
```

### List Branches
```
List branches in repo "ccai-services" matching "feat/*"
```

---

## Provana Branching Conventions

| Branch type | Pattern | Example |
|---|---|---|
| Feature | `feat/<ticket>-<short-desc>` | `feat/PROV-123-add-auth` |
| Bug fix | `fix/<ticket>-<short-desc>` | `fix/PROV-456-token-expiry` |
| Hotfix | `hotfix/<ticket>-<short-desc>` | `hotfix/PROV-789-prod-crash` |
| Release | `release/<version>` | `release/2.4.0` |
| Chore | `chore/<short-desc>` | `chore/update-dependencies` |

**Rules:**
- Always branch from `main` (never from another feature branch)
- Ticket ID required for feat/fix/hotfix — links to ADO work item
- Max 50 chars total (including prefix)
- Lowercase, hyphens only — no underscores, no slashes except prefix

---

## PR Checklist (Provana Standard)

Before creating a PR:
- [ ] Branch name follows convention
- [ ] Work item linked
- [ ] Self-review done (read your own diff)
- [ ] Tests passing locally
- [ ] No debug logs, commented-out code, or TODOs left in
- [ ] PR description filled (see template below)

---

## PR Description Template

```markdown
## Summary
- What this PR does (1-3 bullets)
- Why it was needed

## Work Item
Fixes #<ADO-work-item-id>

## Test Plan
- [ ] Unit tests added/updated
- [ ] Manual test: <describe what you clicked/ran>
- [ ] Edge cases covered: <list>

## Screenshots (if UI change)
Before | After
```

---

## PR Title Format

Same as conventional commit: `type(scope): description`

```
feat(auth): add token refresh mechanism
fix(dashboard): resolve chart render on mobile
chore(deps): update FastAPI to 0.115
```

Max 72 chars. No period at end.

---

## Branch Policies (provanadev standard)

- Minimum **1 reviewer** required before merge
- Build pipeline must pass (CI required)
- Work item linked — enforced by policy
- No direct pushes to `main` or `release/*`
- PR comments must be resolved before merge
- Squash merge preferred (clean history)

---

## Code Review Guidelines

**As reviewer:**
- Approve if: logic correct, no security issues, follows Provana standards
- Request changes if: bug found, missing tests, pattern violation
- Leave comments (not blocking) for style suggestions
- Review within **1 business day** of assignment

**As author:**
- Respond to every comment — either fix or explain why not
- Don't resolve reviewer comments yourself — let reviewer resolve
- Re-request review after addressing all feedback
- Tag reviewer with `@mention` in comment when ready for re-review

---

## ADO → Git Workflow

```
1. Pick work item from sprint backlog
2. Create branch: git checkout -b feat/PROV-123-add-auth main
3. Implement + commit (conventional commits)
4. Push: git push -u origin feat/PROV-123-add-auth
5. Create PR in ADO (Claude can do this via MCP)
6. Link work item to PR
7. Assign reviewers
8. Address feedback → re-request review
9. Merge (squash) → work item auto-resolves
10. Delete branch after merge
```
