# API

This is the complete REST contract. Phase 2 implements it verbatim; frontend hooks in Phase 3–5 consume it without adaptation layers. Base path `/api/v1`. JSON everywhere except BIND import/export.

## Table of contents

1. Conventions
2. Auth
3. Hosted zones
4. Records
5. Changes
6. Import / Export
7. Mocked endpoints
8. Health
9. Pagination, filtering, sorting, errors

## 1. Conventions

1. Auth: cookie `r53_session` (see `docs/ARCHITECTURE.md` §7). All endpoints except `POST /auth/login` and `GET /health` require it; missing/expired returns 401 `NotAuthorized`.
2. Dates are ISO-8601 UTC strings. IDs follow `docs/DATABASE.md` formats.
3. Write responses for record mutations always include a `change` object (R11).
4. Error body is always the AWS envelope from `docs/ROUTE53-DOMAIN-RULES.md` §12.

## 2. Auth

### POST /api/v1/auth/login

Auth: none. Body: `{username: string, password: string}`. Sets httpOnly cookie on success.

Response 200: `{user: {id, username, email, display_name, aws_account_id}, session: {expires_at}}`.

Errors: 401 `NotAuthorized` (`Invalid username or password.`), 422 validation.

```bash
curl -c jar -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}'
```

### POST /api/v1/auth/logout

Auth: required. Response 200: `{ok: true}`. Deletes session row, clears cookie. Errors: 401.

```bash
curl -b jar -X POST localhost:8000/api/v1/auth/logout
```

### GET /api/v1/auth/session

Auth: required. Response 200: `{user: {...same as login...}}`. Errors: 401 `NotAuthorized` (`No active session.`).

```bash
curl -b jar localhost:8000/api/v1/auth/session
```

## 3. Hosted zones

### GET /api/v1/hostedzones

Auth: required. Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| search | string | `""` | Case-insensitive substring on name |
| type | `public\|private` | unset (both) | Zone type filter |
| page_size | int 1–100 | 20 | Items per page |
| next_token | string | unset | Opaque cursor from previous response |
| sort_by | `name\|created_at\|record_set_count` | `name` | Sort key |
| sort_order | `asc\|desc` | `asc` | Sort direction |

Response 200: `{items: [{id, name, comment, type, record_set_count, caller_reference, created_at}], next_token: string|null}`.

```bash
curl -b jar 'localhost:8000/api/v1/hostedzones?search=example&type=public&page_size=20&sort_by=name&sort_order=asc'
```

### POST /api/v1/hostedzones

Auth: required. Body:

```json
{ "name": "example.com", "comment": "optional ≤256 chars",
  "type": "public", "vpc_id": null, "vpc_region": null }
```

`vpc_id` + `vpc_region` required iff `type=private`. Response 201: `{zone: {...}, change: null}` (zone creation returns no change batch; its NS/SOA are system state). Errors: 400 `InvalidInput` (comment length, private VPC missing), 409 `HostedZoneAlreadyExists`.

```bash
curl -b jar -X POST localhost:8000/api/v1/hostedzones \
  -H 'Content-Type: application/json' \
  -d '{"name":"example.com","type":"public","comment":"demo"}'
```

### GET /api/v1/hostedzones/{id}

Auth: required. Response 200: `{zone: {id, name, comment, type, vpc_id, vpc_region, record_set_count, caller_reference, created_at, updated_at}, tags: [{key, value}]}`. Errors: 404 `NoSuchHostedZone`.

```bash
curl -b jar localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM
```

### PATCH /api/v1/hostedzones/{id}

Auth: required. Only comment is editable, mirroring the real console. Body: `{comment: string|null}`. Response 200: `{zone: {...}}`. Errors: 400 `InvalidInput`, 404 `NoSuchHostedZone`.

```bash
curl -b jar -X PATCH localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM \
  -H 'Content-Type: application/json' -d '{"comment":"new description"}'
```

### DELETE /api/v1/hostedzones/{id}

Auth: required. Response 200: `{ok: true}`. Errors: 400 `HostedZoneNotEmpty`, 404 `NoSuchHostedZone`.

```bash
curl -b jar -X DELETE localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM
```

### GET /api/v1/hostedzones/{id}/tags

Auth: required. Response 200: `{tags: [{key, value}]}`. Errors: 404.

```bash
curl -b jar localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/tags
```

### PUT /api/v1/hostedzones/{id}/tags

Auth: required. Full-replace semantics. Body: `{tags: [{key, value}], }` (max 50 tags). Response 200: `{tags: [...]}`. Errors: 400 `InvalidInput` (bad key/value), 404.

```bash
curl -b jar -X PUT localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/tags \
  -H 'Content-Type: application/json' -d '{"tags":[{"key":"env","value":"prod"}]}'
```

## 4. Records

Record object shape (all record endpoints):

```json
{ "id": "uuid", "name": "www.example.com.", "type": "A", "ttl": 300,
  "routing_policy": "simple", "set_identifier": null, "values": ["192.0.2.1"],
  "is_alias": false, "alias_target": null, "is_system": false,
  "created_at": "...", "updated_at": "..." }
```

### GET /api/v1/hostedzones/{id}/rrsets

Auth: required. Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| search | string | `""` | Substring on name or value |
| type | record type | unset | Exact type filter |
| routing_policy | policy | unset | Policy filter |
| alias_only | bool | false | Only alias records |
| page_size | int 1–100 | 50 | Items per page |
| next_token | string | unset | Cursor |
| sort_by | `name\|type\|ttl\|created_at` | `name` | Sort key |
| sort_order | `asc\|desc` | `asc` | Direction |

Response 200: `{items: [record], next_token: string|null}`. Errors: 404 `NoSuchHostedZone`.

```bash
curl -b jar 'localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/rrsets?type=A&page_size=50'
```

### POST /api/v1/hostedzones/{id}/rrsets

Auth: required. Body: `{name, type, ttl, routing_policy?, set_identifier?, weight?, region?, failover?, geo_*?, is_alias?, alias_target?, alias_hosted_zone_id?, alias_evaluate_target_health?, values?: [string]}`. Response 201: `{record, change: {id, status: "PENDING", submitted_at}}`. Errors: 400 `InvalidChangeBatch`, 404, 409 duplicate identifier.

```bash
curl -b jar -X POST localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/rrsets \
  -H 'Content-Type: application/json' \
  -d '{"name":"www.example.com","type":"A","ttl":300,"values":["192.0.2.1"]}'
```

### PUT /api/v1/hostedzones/{id}/rrsets/{rid}

Auth: required. Body: same as POST (full replace). System records: TTL/values editable, delete forbidden. Response 200: `{record, change}`. Errors: 400 `InvalidChangeBatch`, 404 `NoSuchRecord`.

```bash
curl -b jar -X PUT localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/rrsets/RECORDUUID \
  -H 'Content-Type: application/json' -d '{"name":"www.example.com","type":"A","ttl":600,"values":["192.0.2.1"]}'
```

### DELETE /api/v1/hostedzones/{id}/rrsets/{rid}

Auth: required. Response 200: `{change: {id, status, submitted_at}}`. Errors: 400 `InvalidChangeBatch` (system record), 404.

```bash
curl -b jar -X DELETE localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/rrsets/RECORDUUID
```

### POST /api/v1/hostedzones/{id}/rrsets/batch

Auth: required. Body: `{comment?: string, changes: [{action: CREATE|DELETE|UPSERT, record?: {...}, record_id?: string}]}` max 100 items. Response 200: `{change: {id, status, submitted_at}, results: [{action, record_id?, error?}]}`. Items apply atomically per item but the batch commits once; per-item failures return 400 with the first error and no partial commit. Errors: 400 `InvalidChangeBatch` (any item invalid), 404 zone.

```bash
curl -b jar -X POST localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/rrsets/batch \
  -H 'Content-Type: application/json' \
  -d '{"changes":[{"action":"DELETE","record_id":"RECORDUUID"}]}'
```

## 5. Changes

### GET /api/v1/changes/{change_id}

Auth: required. Response 200: `{change: {id, hosted_zone_id, status: PENDING|INSYNC, submitted_at, comment}}`. Status derives from age (≥60 s → INSYNC). Errors: 404 `NoSuchChange`.

```bash
curl -b jar localhost:8000/api/v1/changes/CABCDEFGHIJKLM
```

## 6. Import / Export (bonus, specified now, built in Phase 7)

### POST /api/v1/hostedzones/{id}/import

Auth: required. `multipart/form-data` with field `file` (BIND zone file, ≤1 MB). Query param `action=UPSERT|CREATE` default UPSERT. Response 200: `{change, imported: int, skipped: int, errors: [{line, message}]}`. Non-fatal line errors are collected, not thrown. Errors: 400 `InvalidInput` (unparseable file), 404 zone.

```bash
curl -b jar -X POST 'localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/import?action=UPSERT' \
  -F file=@zone.bind
```

### GET /api/v1/hostedzones/{id}/export

Auth: required. Query `format=json|bind` default json. JSON returns `{zone, records: [...]}`; `bind` returns `text/dns` file download with `$ORIGIN`. Errors: 404.

```bash
curl -b jar 'localhost:8000/api/v1/hostedzones/ZABCDEFGHIJKLM/export?format=bind' -o zone.bind
```

## 7. Mocked endpoints

All return static shapes inside the real shell; auth required.

| Method + path | Response |
|---------------|----------|
| GET /api/v1/health-checks | `{items: [], next_token: null}` |
| GET /api/v1/traffic-policies | `{items: [], next_token: null}` |
| GET /api/v1/dashboard/summary | `{zones: int, records: int, health_checks: 0, traffic_policies: 0}` |

```bash
curl -b jar localhost:8000/api/v1/dashboard/summary
curl -b jar localhost:8000/api/v1/health-checks
```

## 8. Health

`GET /api/v1/health` (no auth): `{ok: true, version: "0.1.0"}`. Used by Docker, Fly, and CI.

## 9. Pagination, filtering, sorting, errors

Pagination: opaque cursor tokens, base64url-encoded JSON `{sort_value, id}` of the last item. Clients pass `next_token` unchanged; tampered tokens return 400 `InvalidInput`. This maps onto Route 53's `NextRecordName`/`NextRecordType` continuation concept with a single opaque field instead of two, and cursor pagination is correct here because zone/record lists mutate between page fetches (offset would skip or duplicate rows) and sort keys are stable. Page size bounds 1–100; default 20 for zones, 50 for records.

Filtering: `search` is a case-insensitive `LIKE %term%` on name (and value for records). Exact-match filters (`type`, `routing_policy`) use equality. `alias_only=true` adds `is_alias=1`.

Sorting: `sort_by` whitelisted per resource; ties broken by `id` for determinism. Invalid sort keys return 422.

Status codes and AWS codes:

| HTTP | AWS Code | When |
|------|----------|------|
| 200/201 | — | Success |
| 400 | InvalidChangeBatch | Domain-rule violation R2, R4–R8 |
| 400 | HostedZoneNotEmpty | R3 |
| 400 | InvalidInput | R10, bad cursor, bad import file |
| 401 | NotAuthorized | Missing/expired session, bad login |
| 404 | NoSuchHostedZone / NoSuchRecord / NoSuchChange | Unknown id |
| 409 | HostedZoneAlreadyExists | R9 |
| 422 | ValidationError | Pydantic schema failure |
| 500 | InternalError | Unexpected failure |
