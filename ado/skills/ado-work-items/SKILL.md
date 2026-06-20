---
name: ado-work-items
description: >
  Azure DevOps work items — creating, updating, linking to PRs, sprint planning,
  queries. Use when managing backlog, creating tasks/bugs/user stories, updating
  status, assigning work, or planning sprints in the provanadev ADO organization.
---

# Azure DevOps Work Items

MCP tools available after `provana-ado` plugin is installed. Uses the `azure_devops`
MCP server (org: `provanadev`).

## Available MCP Tools

After install, Claude has direct ADO tools. Key operations:

### Create Work Item
```
Create a Bug in project "core" titled "Login page crashes on mobile"
assigned to me, priority 1, iteration "Sprint 23"
```

### Update Work Item
```
Update work item #4521 — set state to "In Progress", add comment "Started implementation"
```

### Query Work Items
```
List all active bugs assigned to me in project "core"
List work items in current sprint for team "backend"
```

### Link Work Item to PR
```
Link work item #4521 to PR #87 in repository "ccai-services"
```

---

## Work Item Types (Provana)

| Type | When to use |
|---|---|
| `User Story` | Feature from product backlog |
| `Task` | Sub-task under a User Story |
| `Bug` | Defect found in testing or production |
| `Feature` | Large capability grouping multiple stories |
| `Epic` | Business initiative grouping features |

---

## States

```
New → Active → Resolved → Closed
              ↓
           Blocked (tag, not a state)
```

- Move to **Active** when you start work
- Move to **Resolved** when PR is merged, pending QA sign-off
- Move to **Closed** after QA passes

---

## Provana Conventions

- **Always link** work items to PRs before merge — required for traceability
- **Sprint assignment** required before moving to Active
- **Priority:** 1 = Critical, 2 = High, 3 = Medium, 4 = Low
- **Title format:** `[Component] Short description` e.g. `[Auth] Fix token refresh on mobile`
- **Tags:** use for cross-cutting concerns: `compliance`, `security`, `hotfix`, `tech-debt`
- **Acceptance criteria** in description (not comments) — write before coding starts

---

## Common Queries

```
# My active work items
assignedTo = @me AND state = "Active"

# Sprint backlog
iterationPath = @currentIteration AND state <> "Closed"

# Unassigned bugs in current sprint
workItemType = "Bug" AND assignedTo = "" AND iterationPath = @currentIteration

# Blocked items (tagged)
tags contains "blocked"
```

---

## Sprint Planning Workflow

1. Product owner populates backlog with User Stories + acceptance criteria
2. Team estimates (story points in `Story Points` field)
3. Sprint planning: move items to sprint iteration, assign owners
4. Daily: update state + add comments on blockers
5. End of sprint: all items Resolved or moved to next sprint with reason

---

## Integration with PRs

When creating a PR in ADO, always:
1. Reference work item in PR title: `Fixes #4521 — [Auth] Fix token refresh`
2. Link via PR → Work Items tab (or Claude can do this via MCP)
3. Work item auto-moves to Resolved on PR merge (if configured in branch policy)
