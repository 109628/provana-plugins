---
name: api-design
description: >
  REST API design, OpenAPI spec, status codes, error schemas, versioning. Use when
  designing or reviewing REST endpoints, writing OpenAPI specs, or choosing HTTP patterns.
---

# API Design — Provana Standards

## Resource Naming

- Plural nouns: `/orders`, `/users`, `/invoices`
- No verbs in paths — use HTTP method to express action
- Nested resources for ownership: `/users/{id}/orders`
- Max two levels of nesting; flatten beyond that

```
# Correct
GET  /v1/users/{id}
POST /v1/users/{id}/orders
GET  /v1/orders?userId={id}   # prefer query param over deep nesting

# Wrong
POST /v1/createUser
GET  /v1/getOrderByUserId
```

## HTTP Methods

| Method | Semantics | Idempotent | Safe |
|--------|-----------|-----------|------|
| `GET` | Read resource(s) | Yes | Yes |
| `POST` | Create resource; non-idempotent action | No | No |
| `PUT` | Full replace of resource | Yes | No |
| `PATCH` | Partial update | No | No |
| `DELETE` | Remove resource | Yes | No |

Use `POST` for operations that don't map to CRUD (e.g. `/orders/{id}/cancel`).

## Status Codes

| Code | When |
|------|------|
| `200 OK` | Successful GET, PATCH, DELETE |
| `201 Created` | Successful POST that created a resource |
| `204 No Content` | Successful DELETE with no body |
| `400 Bad Request` | Malformed request syntax |
| `401 Unauthorized` | Missing or invalid auth token |
| `403 Forbidden` | Valid token but insufficient permissions |
| `404 Not Found` | Resource does not exist |
| `422 Unprocessable Entity` | Valid syntax but failed business validation |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server fault |

## Error Response Schema

All error responses use this envelope — never vary the structure:

```json
{
  "error": {
    "code": "SNAKE_CASE_CONSTANT",
    "message": "Human-readable description of what went wrong",
    "details": {}
  },
  "requestId": "req_01HXYZ..."
}
```

- `code`: machine-readable constant in `UPPER_SNAKE_CASE`
- `message`: safe to show to end users; no stack traces
- `details`: optional; field-level errors for 422 responses
- `requestId`: always present — used for distributed tracing

### 422 Example with field errors

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": {
      "fields": [
        { "field": "email", "issue": "Invalid email format" },
        { "field": "dueDate", "issue": "Must be a future date" }
      ]
    }
  },
  "requestId": "req_01HXYZ..."
}
```

## Response Envelope

All success responses include `requestId` for tracing:

```json
{
  "data": { ... },
  "requestId": "req_01HXYZ..."
}
```

List responses add pagination metadata:

```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJpZCI6MTIzfQ==",
    "hasMore": true,
    "limit": 20
  },
  "requestId": "req_01HXYZ..."
}
```

## Versioning

- URL-based prefix: `/v1/`, `/v2/`
- Never version individual endpoints — version the whole API surface
- Breaking changes require a new major version
- Maintain previous version for minimum 6 months after new version ships
- Deprecation: return `Deprecation: true` and `Sunset: <date>` headers

## Pagination

Prefer **cursor-based** over offset for large or frequently-updated datasets:

```
GET /v1/orders?cursor=eyJpZCI6MTIzfQ==&limit=20
```

Use offset only for small, rarely-updated datasets where UX demands page numbers:

```
GET /v1/reports?page=2&pageSize=50
```

## OpenAPI 3.1 Structure

```yaml
openapi: "3.1.0"
info:
  title: Service Name API
  version: "1.0.0"
  description: One-line description

servers:
  - url: https://api.provana.com/v1

paths:
  /users/{id}:
    get:
      operationId: getUserById
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserResponse"
        "404":
          $ref: "#/components/responses/NotFound"

components:
  schemas:
    UserResponse:
      type: object
      required: [data, requestId]
      properties:
        data:
          $ref: "#/components/schemas/User"
        requestId:
          type: string
  responses:
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
```

## What to Avoid

- Verbs in resource paths
- Returning `200` for errors
- Inconsistent error shapes across endpoints
- Exposing internal IDs or database row IDs directly (use UUIDs or opaque IDs)
- Omitting `requestId` from any response
- Breaking changes without a version bump
