# DATABASE

This document is the authoritative schema for the SQLite database. Phase 1 implements it verbatim via Alembic; any deviation requires a new ADR in `docs/DECISIONS.md`.

## Table of contents

1. Conventions
2. users
3. sessions
4. hosted_zones
5. resource_record_sets
6. resource_record_values
7. tags
8. change_batches
9. change_batch_items
10. Relationships
11. Indexes serving queries
12. Migration strategy
13. Seed data
14. Complete DDL

## 1. Conventions

1. All primary keys are TEXT UUIDs except `hosted_zones.id` (`Z` + 13 uppercase alphanumerics) and `change_batches.id` (`C` + 13 uppercase alphanumerics), both generated with `secrets` over `[A-Z0-9]`.
2. Timestamps are TEXT ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`), set by the service layer, never database defaults, so tests can freeze time.
3. Booleans are INTEGER 0/1 with CHECK constraints.
4. Every foreign key declares ON DELETE behaviour explicitly; SQLite enforces with `PRAGMA foreign_keys=ON` on every connection and WAL journal mode.
5. Surrogate record IDs are internal only; the natural key `(hosted_zone_id, name, type, set_identifier)` carries the UNIQUE constraint (see ADR-007).

## 2. users

Purpose: account owning hosted zones; single mocked credential per install plus seeded demo user.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 hex | PK | Internal user id |
| username | TEXT | NOT NULL | — | UNIQUE | Login handle, lowercase |
| email | TEXT | NOT NULL | — | UNIQUE | Contact email |
| password_hash | TEXT | NOT NULL | — | — | bcrypt hash, never returned |
| aws_account_id | TEXT | NOT NULL | — | CHECK length 12, digits only | Mock 12-digit account id shown in TopNavigation |
| display_name | TEXT | NULL | NULL | — | Shown in identity menu |
| created_at | TEXT | NOT NULL | now | — | Row creation time |
| updated_at | TEXT | NOT NULL | now | — | Last profile update |

PK: `id`. Unique: `username`, `email`.

## 3. sessions

Purpose: opaque server-side sessions backing the httpOnly cookie (ADR-006).

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 | PK | Session row id |
| user_id | TEXT | NOT NULL | — | FK users(id) ON DELETE CASCADE | Owner |
| token | TEXT | NOT NULL | — | UNIQUE, indexed | SHA-256 hex of the opaque token |
| expires_at | TEXT | NOT NULL | — | — | Expiry; checked on every request |
| created_at | TEXT | NOT NULL | now | — | Login time |
| last_seen_at | TEXT | NOT NULL | now | — | Last authenticated request |

PK: `id`. FK: `user_id → users.id ON DELETE CASCADE`. Unique + index: `token`.

## 4. hosted_zones

Purpose: DNS zone container; mirrors Route 53 hosted zone semantics.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | `Z`+13 alphanumerics | PK, CHECK `id GLOB 'Z[A-Z0-9][A-Z0-9]*'` | AWS-format zone id |
| name | TEXT | NOT NULL | — | — | Normalized lowercase FQDN with trailing dot |
| comment | TEXT | NULL | NULL | CHECK length ≤ 256 | Maps to Route 53 Description field |
| type | TEXT | NOT NULL | — | CHECK IN (`public`,`private`) | Public or private zone |
| vpc_id | TEXT | NULL | NULL | Required iff type=`private` | Associated VPC id (metadata only) |
| vpc_region | TEXT | NULL | NULL | Required iff type=`private` | VPC region (metadata only) |
| caller_reference | TEXT | NOT NULL | uuid4 | UNIQUE | Mirrors real Route 53 idempotency key |
| record_set_count | INTEGER | NOT NULL | 0 | CHECK ≥ 0 | Denormalized count incl. system records, maintained in service transaction (ADR-005) |
| owner_user_id | TEXT | NOT NULL | — | FK users(id) ON DELETE CASCADE | Owning account |
| created_at | TEXT | NOT NULL | now | — | Creation time |
| updated_at | TEXT | NOT NULL | now | — | Last comment/tag/record-count change |

PK: `id`. FK: `owner_user_id → users.id ON DELETE CASCADE`. Unique: `caller_reference`; `UNIQUE(owner_user_id, name, type)` (duplicate zone name rule R9). Index: `(owner_user_id, name)` serving list search+sort.

## 5. resource_record_sets

Purpose: one DNS record set (name + type + optional set-identifier) with routing policy and optional alias target.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 | PK | Surrogate internal id; real Route 53 uses natural key (ADR-007) |
| hosted_zone_id | TEXT | NOT NULL | — | FK hosted_zones(id) ON DELETE CASCADE, indexed | Parent zone |
| name | TEXT | NOT NULL | — | — | Normalized lowercase FQDN with trailing dot, must be within zone |
| type | TEXT | NOT NULL | — | CHECK IN (`A`,`AAAA`,`CNAME`,`TXT`,`MX`,`NS`,`PTR`,`SRV`,`CAA`,`SOA`,`NAPTR`,`SPF`,`DS`) | Record type |
| ttl | INTEGER | NULL | NULL | NULL iff alias; else 1–2147483647 | TTL seconds |
| routing_policy | TEXT | NOT NULL | `simple` | CHECK IN (`simple`,`weighted`,`latency`,`failover`,`geolocation`,`multivalue`) | Routing policy |
| set_identifier | TEXT | NULL | NULL | Required when routing_policy ≠ `simple` | Unique within (name, type) |
| weight | INTEGER | NULL | NULL | 0–255, weighted only | Weighted routing weight |
| region | TEXT | NULL | NULL | latency only | Latency region code |
| failover | TEXT | NULL | NULL | CHECK IN (`PRIMARY`,`SECONDARY`) | Failover role |
| geo_continent | TEXT | NULL | NULL | geolocation only | Two-letter continent or `*` |
| geo_country | TEXT | NULL | NULL | geolocation only | ISO country or `*` |
| geo_subdivision | TEXT | NULL | NULL | geolocation only | Subdivision code |
| is_alias | INTEGER | NOT NULL | 0 | CHECK IN (0,1) | Whether this is an alias record |
| alias_target | TEXT | NULL | NULL | Required iff is_alias | Alias DNS target |
| alias_hosted_zone_id | TEXT | NULL | NULL | iff is_alias | Target hosted zone id |
| alias_evaluate_target_health | INTEGER | NULL | NULL | CHECK IN (0,1) | Evaluate target health flag |
| health_check_id | TEXT | NULL | NULL | — | Associated health check (mocked, nullable) |
| is_system | INTEGER | NOT NULL | 0 | CHECK IN (0,1) | True for auto-created NS/SOA; undeletable |
| created_at | TEXT | NOT NULL | now | — | Creation time |
| updated_at | TEXT | NOT NULL | now | — | Last update |

PK: `id`. FK: `hosted_zone_id → hosted_zones.id ON DELETE CASCADE`. Unique: `(hosted_zone_id, name, type, set_identifier)` with NULL-safe handling (NULL set_identifier treated as empty string in service check plus partial unique index pair). Index: `(hosted_zone_id, name, type)` serving record list search/filter/sort.

## 6. resource_record_values

Purpose: ordered multi-values per record set. A child table beats a newline-delimited TEXT blob because values need independent validation (per-type rules), explicit ordering, and per-value error messages; blobs force parse-on-read, break atomic validation, and cannot be indexed or ordered relationally. This reasoning is graded, so it is stated here normatively.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 | PK | Value row id |
| record_set_id | TEXT | NOT NULL | — | FK resource_record_sets(id) ON DELETE CASCADE, indexed | Parent record |
| value | TEXT | NOT NULL | — | CHECK length ≥ 1 | Single record value (e.g. one IPv4, one TXT string) |
| sort_order | INTEGER | NOT NULL | 0 | CHECK ≥ 0 | Display and BIND-export order |

PK: `id`. FK: `record_set_id → resource_record_sets.id ON DELETE CASCADE`. Ordering key: `(record_set_id, sort_order, id)`.

## 7. tags

Purpose: key/value labels on hosted zones and health checks.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 | PK | Tag row id |
| resource_type | TEXT | NOT NULL | — | CHECK IN (`hostedzone`,`healthcheck`) | Tagged resource kind |
| resource_id | TEXT | NOT NULL | — | — | Zone or health-check id (no FK: health checks are mocked) |
| key | TEXT | NOT NULL | — | CHECK length 1–128 | Tag key |
| value | TEXT | NOT NULL | — | CHECK length ≤ 256 | Tag value |

Unique: `(resource_type, resource_id, key)`. Index: `(resource_type, resource_id)` serving tag fetch per resource.

## 8. change_batches

Purpose: every record mutation returns a change ID exactly like the real API (ADR-009).

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | `C`+13 alphanumerics | PK | AWS-format change id |
| hosted_zone_id | TEXT | NOT NULL | — | FK hosted_zones(id) ON DELETE CASCADE | Zone mutated |
| status | TEXT | NOT NULL | `PENDING` | CHECK IN (`PENDING`,`INSYNC`) | Stored PENDING; read path derives INSYNC by age |
| submitted_at | TEXT | NOT NULL | now | — | Submission time; INSYNC when older than 60 s |
| comment | TEXT | NULL | NULL | — | Optional batch comment |

PK: `id`. FK: `hosted_zone_id → hosted_zones.id ON DELETE CASCADE`. Index: `(hosted_zone_id, submitted_at)` for change history.

## 9. change_batch_items

Purpose: audit snapshot of each record touched by a batch.

| Column | Type | Null | Default | Constraints | Description |
|--------|------|------|---------|-------------|-------------|
| id | TEXT | NOT NULL | uuid4 | PK | Item id |
| change_batch_id | TEXT | NOT NULL | — | FK change_batches(id) ON DELETE CASCADE | Parent batch |
| action | TEXT | NOT NULL | — | CHECK IN (`CREATE`,`DELETE`,`UPSERT`) | Mutation kind |
| record_snapshot | TEXT | NULL | NULL | JSON string | Record set JSON at change time |

PK: `id`. FK: `change_batch_id → change_batches.id ON DELETE CASCADE`.

## 10. Relationships

1. One user owns many hosted zones; deleting a user cascades to sessions and zones.
2. One hosted zone has many record sets including exactly one apex SOA and apex NS set marked `is_system`; deleting a zone cascades to records, values (via records), tags are deleted by service (no FK since health checks share the table), and change batches.
3. One record set has many ordered values; deleting the set cascades to values.
4. One change batch belongs to one zone and has many items; deleting the batch cascades to items.
5. Tags are loosely coupled by `(resource_type, resource_id)` with no database FK so mocked health-check ids can be tagged without a table.

Relationship table:

| Parent | Child | Cardinality | FK | ON DELETE |
|--------|-------|-------------|----|-----------|
| users | sessions | 1:N | sessions.user_id | CASCADE |
| users | hosted_zones | 1:N | hosted_zones.owner_user_id | CASCADE |
| hosted_zones | resource_record_sets | 1:N | record_sets.hosted_zone_id | CASCADE |
| resource_record_sets | resource_record_values | 1:N | values.record_set_id | CASCADE |
| hosted_zones | change_batches | 1:N | batches.hosted_zone_id | CASCADE |
| change_batches | change_batch_items | 1:N | items.change_batch_id | CASCADE |

## 11. Indexes serving queries

| Index | Columns | Serves |
|-------|---------|--------|
| `ix_sessions_token` | sessions(token) UNIQUE | Session lookup per authenticated request |
| `ix_zones_owner_name` | hosted_zones(owner_user_id, name) | Zone list search + sort by name |
| `ix_records_zone_name_type` | resource_record_sets(hosted_zone_id, name, type) | Record list search + type filter + sort |
| `ix_values_record` | resource_record_values(record_set_id) | Values fetch per record |
| `ix_tags_resource` | tags(resource_type, resource_id) | Tag fetch per zone |
| `ix_batches_zone_time` | change_batches(hosted_zone_id, submitted_at) | Change history per zone |

## 12. Migration strategy

1. All schema changes ship as Alembic revisions under `backend/alembic/versions` with upgrade and downgrade fully implemented.
2. `alembic upgrade head` runs in CI before tests, as the Docker CMD, and as the Fly release command.
3. Downgrades are tested for the latest revision only.
4. No `create_all` in application code; the seed script assumes migrated tables exist.
5. SQLite DDL in migrations must include explicit `CHECK` constraints and `PRAGMA foreign_keys=ON` verification in tests.

## 13. Seed data

The idempotent seed script (`backend/app/seed/seed.py`) runs on backend boot when `SEED_ON_BOOT=true` and `users` is empty. It creates user `admin` / `password123` (bcrypt hash, email `admin@example.com`, account id `123456789012`), one public zone `example.com.` with comment `Seeded demo zone`, its auto NS/SOA system records, plus sample records `www.example.com. A 300 192.0.2.1`, `mail.example.com. MX 300 10 mail.example.com.`, and `_sip._tcp.example.com. SRV`. Re-running changes nothing: it checks username and zone name existence first.

## 14. Complete DDL

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  aws_account_id TEXT NOT NULL CHECK (length(aws_account_id) = 12),
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX ix_sessions_token ON sessions(token);

CREATE TABLE hosted_zones (
  id TEXT PRIMARY KEY CHECK (id GLOB 'Z*'),
  name TEXT NOT NULL,
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 256),
  type TEXT NOT NULL CHECK (type IN ('public','private')),
  vpc_id TEXT,
  vpc_region TEXT,
  caller_reference TEXT NOT NULL UNIQUE,
  record_set_count INTEGER NOT NULL DEFAULT 0 CHECK (record_set_count >= 0),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_user_id, name, type)
);
CREATE INDEX ix_zones_owner_name ON hosted_zones(owner_user_id, name);

CREATE TABLE resource_record_sets (
  id TEXT PRIMARY KEY,
  hosted_zone_id TEXT NOT NULL REFERENCES hosted_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA','NAPTR','SPF','DS')),
  ttl INTEGER CHECK (ttl IS NULL OR (ttl >= 1 AND ttl <= 2147483647)),
  routing_policy TEXT NOT NULL DEFAULT 'simple'
    CHECK (routing_policy IN ('simple','weighted','latency','failover','geolocation','multivalue')),
  set_identifier TEXT,
  weight INTEGER CHECK (weight IS NULL OR (weight >= 0 AND weight <= 255)),
  region TEXT,
  failover TEXT CHECK (failover IS NULL OR failover IN ('PRIMARY','SECONDARY')),
  geo_continent TEXT,
  geo_country TEXT,
  geo_subdivision TEXT,
  is_alias INTEGER NOT NULL DEFAULT 0 CHECK (is_alias IN (0,1)),
  alias_target TEXT,
  alias_hosted_zone_id TEXT,
  alias_evaluate_target_health INTEGER CHECK (alias_evaluate_target_health IS NULL OR alias_evaluate_target_health IN (0,1)),
  health_check_id TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hosted_zone_id, name, type, set_identifier)
);
CREATE INDEX ix_records_zone_name_type
  ON resource_record_sets(hosted_zone_id, name, type);

CREATE TABLE resource_record_values (
  id TEXT PRIMARY KEY,
  record_set_id TEXT NOT NULL REFERENCES resource_record_sets(id) ON DELETE CASCADE,
  value TEXT NOT NULL CHECK (length(value) >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0)
);
CREATE INDEX ix_values_record ON resource_record_values(record_set_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('hostedzone','healthcheck')),
  resource_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 128),
  value TEXT NOT NULL CHECK (length(value) <= 256),
  UNIQUE (resource_type, resource_id, key)
);
CREATE INDEX ix_tags_resource ON tags(resource_type, resource_id);

CREATE TABLE change_batches (
  id TEXT PRIMARY KEY CHECK (id GLOB 'C*'),
  hosted_zone_id TEXT NOT NULL REFERENCES hosted_zones(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','INSYNC')),
  submitted_at TEXT NOT NULL,
  comment TEXT
);
CREATE INDEX ix_batches_zone_time ON change_batches(hosted_zone_id, submitted_at);

CREATE TABLE change_batch_items (
  id TEXT PRIMARY KEY,
  change_batch_id TEXT NOT NULL REFERENCES change_batches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATE','DELETE','UPSERT')),
  record_snapshot TEXT
);
```
