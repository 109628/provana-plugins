---
name: code-review
description: >
  E2E code review checklist — correctness, security, performance, naming, test coverage,
  language-specific rules (Python/FastAPI, TypeScript/Next.js, SQL). Use before creating
  a PR, when asked to review code, or when self-reviewing your own changes.
---

# Provana Code Review

Run this checklist on every PR — self-review before requesting reviewers.

## Review Order

1. Correctness — does it do what it claims?
2. Security — any vectors introduced?
3. Tests — is coverage adequate?
4. Performance — any obvious regressions?
5. Readability — will the next person understand this?
6. Standards — follows Provana conventions?

---

## Universal Checklist

### Correctness
- [ ] Logic handles the happy path correctly
- [ ] Edge cases covered: empty input, null/None, zero, negative, max values
- [ ] Error paths return meaningful errors (not silent failures)
- [ ] No off-by-one errors in loops/pagination
- [ ] Async/await used correctly — no unhandled promise rejections / unawaited coroutines
- [ ] Race conditions: no shared mutable state accessed from concurrent code without locking

### Security
- [ ] No secrets, tokens, or credentials in code or comments
- [ ] User input validated/sanitized at system boundaries
- [ ] SQL: parameterized queries only — no string concatenation
- [ ] No eval(), exec(), or dynamic code execution with user input
- [ ] File paths: no path traversal (`../`) possible from user input
- [ ] Auth checks present on every route that needs them
- [ ] Error messages don't expose stack traces or internal details to end users

### Tests
- [ ] New code has tests — at minimum happy path + one failure case
- [ ] Tests test behaviour, not implementation (don't assert internal calls)
- [ ] Mocks only at system boundaries (external APIs, DB) — never mock internal functions
- [ ] Test names describe what they test: `test_login_fails_with_wrong_password`
- [ ] No `time.sleep()` or arbitrary waits in tests — use mocks or fixtures

### Performance
- [ ] No N+1 queries (loop calling DB inside loop)
- [ ] Pagination on any endpoint returning lists — never return unbounded results
- [ ] Heavy operations are async and non-blocking
- [ ] No unnecessary data fetched (SELECT * avoided in hot paths)
- [ ] Caching used where appropriate for expensive repeated operations

### Readability
- [ ] Function/method does one thing
- [ ] Names are descriptive — no single-letter variables outside list comprehensions
- [ ] No commented-out dead code
- [ ] No TODO comments without a ticket reference
- [ ] Complex logic has a comment explaining WHY (not what)
- [ ] PR is small enough to review in one sitting (< 400 lines changed ideally)

### Provana Standards
- [ ] Conventional commit format used
- [ ] Branch name follows `feat/PROV-XXX-description` convention
- [ ] Work item linked to PR
- [ ] No `--no-verify` on commits

---

## Python / FastAPI Specific

- [ ] Pydantic models for all request/response bodies — no raw dicts at API boundary
- [ ] `pydantic-settings` for config — no `os.environ.get()` scattered in business logic
- [ ] Async endpoints use `async def` — sync endpoints use `def` (FastAPI handles threads)
- [ ] Dependencies injected via `Depends()` — no global state
- [ ] Database sessions closed properly — use context managers or `yield` dependencies
- [ ] `logging` used — no `print()` statements
- [ ] `uv` used for deps — no manual `pyproject.toml` edits, no `pip install` in code
- [ ] Type hints on all function signatures
- [ ] `ruff` passes with no errors
- [ ] `mypy` passes (or suppressions have comments explaining why)

```python
# WRONG
@app.get("/users")
async def get_users():
    users = db.query("SELECT * FROM users")  # no pagination, no parameterization
    print(users)                              # print in production code
    return users                             # raw dict, no Pydantic

# CORRECT
@app.get("/users", response_model=list[UserResponse])
async def get_users(
    page: int = 1,
    limit: int = Query(default=25, le=100),
    db: AsyncSession = Depends(get_db)
) -> list[UserResponse]:
    return await user_service.list(db, page=page, limit=limit)
```

---

## TypeScript / Next.js Specific

- [ ] `strict: true` in tsconfig — no `any` without explicit justification
- [ ] Server Components default — only use `"use client"` when needed (event handlers, hooks, browser APIs)
- [ ] `next/image` for all images — no raw `<img>` tags
- [ ] `next/link` for navigation — no `<a href>` for internal routes
- [ ] Error boundaries present for async server components
- [ ] Environment variables accessed via validated config object — not `process.env.X` scattered
- [ ] No `console.log` in production code — use proper logging
- [ ] Zod schema validates all external data (API responses, form inputs, env vars)
- [ ] ESLint passes with no errors or disabled rules without explanation

```tsx
// WRONG
export default async function Page() {
  const data = await fetch('/api/data').then(r => r.json()) as any
  return <img src={data.imageUrl} />  // no next/image, no type safety
}

// CORRECT
export default async function Page() {
  const data = await fetchData()  // typed, validated with Zod
  return <Image src={data.imageUrl} alt={data.title} width={400} height={300} />
}
```

---

## SQL / Database Specific

- [ ] Parameterized queries only
- [ ] Indexes exist for columns used in WHERE/JOIN/ORDER BY on large tables
- [ ] Migrations are reversible (have a `down` migration)
- [ ] No `DROP TABLE` / `DROP COLUMN` without data backup step
- [ ] Transactions used for multi-step writes that must be atomic
- [ ] Connection pooling configured — no new connection per request

---

## Severity Guide

When leaving review comments, tag severity:

| Tag | Meaning |
|---|---|
| `[blocker]` | Must fix before merge — bug, security issue, missing test |
| `[major]` | Should fix — significant quality issue, but not a bug |
| `[minor]` | Nice to have — style, naming, minor improvement |
| `[question]` | Asking for understanding — not requesting a change |

Only `[blocker]` items prevent approval.
