---
name: test-coverage
description: >
  Test coverage strategy and patterns for Python (pytest) and TypeScript/JavaScript
  (jest/vitest). Coverage thresholds, what to test vs mock, integration vs unit tests.
  Use when writing tests, reviewing test quality, or setting up a test suite from scratch.
---

# Provana Test Coverage

## Coverage Thresholds (Provana minimum)

| Project type | Unit | Integration | Overall |
|---|---|---|---|
| FastAPI microservice | 75% | key endpoints covered | 70% |
| Next.js frontend | 60% | critical flows covered | 60% |
| Data pipeline | 80% | pipeline E2E tested | 75% |
| Shared library | 90% | — | 85% |

Coverage below threshold = PR cannot merge.

---

## What to Test vs What to Mock

### Test (real implementation)
- Business logic functions
- Data transformations
- Validation rules
- Error handling paths
- Edge cases (empty, null, boundary values)

### Mock (at system boundary only)
- External HTTP APIs
- Database calls (unit tests only — integration tests hit real DB)
- File system (when not the subject under test)
- Time/dates (`datetime.now()`, `Date.now()`)
- Third-party SDKs (Langfuse, LiveKit, Azure)

### Never mock
- Internal functions of the module under test
- Pydantic models
- Pure utility functions
- Business logic that is the point of the test

---

## Python / pytest

### Setup

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=app --cov-report=term-missing --cov-fail-under=70"

[tool.coverage.run]
omit = ["tests/*", "*/migrations/*", "*/alembic/*"]
```

### File structure

```
tests/
├── conftest.py          ← fixtures (DB session, test client, mocks)
├── unit/
│   ├── test_services.py
│   └── test_utils.py
└── integration/
    ├── test_api_users.py
    └── test_api_calls.py
```

### Fixtures pattern

```python
# conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

@pytest.fixture(scope="session")
def engine():
    return create_async_engine("sqlite+aiosqlite:///:memory:")

@pytest.fixture
async def db(engine) -> AsyncSession:
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(app) -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
```

### Unit test pattern

```python
# tests/unit/test_call_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.call_service import CallService

class TestCallService:
    async def test_create_call_returns_id(self, db):
        service = CallService(db)
        call = await service.create(agent_id="agent-1", phone="5551234567")
        assert call.id is not None
        assert call.status == "queued"

    async def test_create_call_fails_on_dnc_number(self, db):
        service = CallService(db)
        with pytest.raises(DNCViolationError):
            await service.create(agent_id="agent-1", phone="5550000000")  # DNC number

    async def test_create_call_calls_external_api(self, db):
        with patch("app.services.call_service.livekit_client") as mock_lk:
            mock_lk.create_room = AsyncMock(return_value={"room_id": "room-123"})
            service = CallService(db)
            call = await service.create(agent_id="agent-1", phone="5551234567")
            mock_lk.create_room.assert_called_once()
```

### Integration test pattern

```python
# tests/integration/test_api_calls.py
async def test_create_call_endpoint_returns_201(client, auth_headers):
    response = await client.post(
        "/api/v1/calls",
        json={"agent_id": "agent-1", "phone": "5551234567"},
        headers=auth_headers
    )
    assert response.status_code == 201
    assert "id" in response.json()

async def test_create_call_returns_422_on_invalid_phone(client, auth_headers):
    response = await client.post(
        "/api/v1/calls",
        json={"agent_id": "agent-1", "phone": "not-a-phone"},
        headers=auth_headers
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "phone"]
```

### Run tests

```bash
# All tests with coverage
pytest

# Unit tests only (fast)
pytest tests/unit/

# Specific test
pytest tests/integration/test_api_calls.py::test_create_call_endpoint_returns_201 -v

# Coverage report in browser
pytest --cov=app --cov-report=html && open htmlcov/index.html
```

---

## TypeScript / Jest or Vitest

### Setup (Vitest — preferred for Next.js)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 60, functions: 60, branches: 60 },
      exclude: ['**/*.config.*', '**/types/**', '**/*.d.ts'],
    },
  },
})
```

### File structure

```
src/
├── lib/
│   ├── call-service.ts
│   └── call-service.test.ts   ← co-located tests
├── components/
│   ├── CallTable.tsx
│   └── CallTable.test.tsx
└── app/
    └── api/
        └── calls/
            └── route.test.ts  ← API route tests
```

### Unit test pattern

```typescript
// lib/call-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CallService } from './call-service'

describe('CallService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates call and returns id', async () => {
    const mockDb = { calls: { create: vi.fn().mockResolvedValue({ id: 'call-1' }) } }
    const service = new CallService(mockDb as any)
    const result = await service.create({ agentId: 'agent-1', phone: '5551234567' })
    expect(result.id).toBe('call-1')
  })

  it('throws on DNC number', async () => {
    const service = new CallService({} as any)
    await expect(
      service.create({ agentId: 'agent-1', phone: '5550000000' })
    ).rejects.toThrow('DNC violation')
  })
})
```

### Component test pattern

```tsx
// components/CallTable.test.tsx
import { render, screen } from '@testing-library/react'
import { CallTable } from './CallTable'

const mockCalls = [
  { id: '1', agentName: 'John', status: 'completed', duration: 120 },
]

describe('CallTable', () => {
  it('renders agent names', () => {
    render(<CallTable calls={mockCalls} />)
    expect(screen.getByText('John')).toBeInTheDocument()
  })

  it('shows empty state when no calls', () => {
    render(<CallTable calls={[]} />)
    expect(screen.getByText(/no records found/i)).toBeInTheDocument()
  })
})
```

### Run tests

```bash
# All tests with coverage
npx vitest run --coverage

# Watch mode during development
npx vitest

# Specific file
npx vitest run src/lib/call-service.test.ts
```

---

## Test Naming Convention

```
# Python
test_<function>_<condition>_<expected>
test_create_call_with_dnc_number_raises_error
test_get_agents_with_no_agents_returns_empty_list

# TypeScript
describe('<Component/Function>')
  it('<condition> <expected result>')
  it('returns empty array when no data provided')
  it('calls onDelete when delete button clicked')
```

---

## Coverage Anti-Patterns

```python
# WRONG — testing implementation, not behaviour
def test_calls_database():
    service = CallService()
    service.create(...)
    assert service.db.execute.called  # who cares how it works internally

# WRONG — no assertions
def test_create_call():
    service = CallService()
    service.create(...)  # what are we even testing?

# WRONG — testing the framework, not your code
def test_pydantic_validation():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email")  # pytest tests Pydantic, not your code

# CORRECT — test your business rules
def test_create_user_rejects_duplicate_email(db):
    await user_service.create(db, email="a@b.com")
    with pytest.raises(DuplicateEmailError):
        await user_service.create(db, email="a@b.com")
```
