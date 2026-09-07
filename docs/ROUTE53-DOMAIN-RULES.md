# ROUTE53-DOMAIN-RULES

This document defines the behavioural rules that make the clone feel like Route 53 rather than generic CRUD. Services enforce them in the order listed; routers never duplicate them. Every rule states its trigger, exact error code and message, and enforcement point.

## Table of contents

1. R1 Auto-created NS + SOA
2. R2 System records cannot be deleted
3. R3 Zone delete guarded by HostedZoneNotEmpty
4. R4 CNAME coexistence
5. R5 Name normalization and zone membership
6. R6 TTL vs alias
7. R7 Per-type value validation
8. R8 Set-identifier for non-simple routing
9. R9 Duplicate zone names
10. R10 Comment length
11. R11 Change-batch status simulation
12. Error envelope

## 1. R1 Auto-created NS + SOA

Description: Creating a hosted zone auto-creates 5 system records: 4 NS records at the apex and 1 SOA record at the apex, all marked `is_system=1`.

Trigger condition: successful `POST /api/v1/hostedzones`.

Values: NS targets `ns-2048.awsdns-64.com.`, `ns-2049.awsdns-65.net.`, `ns-2050.awsdns-66.org.`, `ns-2051.awsdns-67.co.uk.` with TTL 172800; SOA value `ns-2048.awsdns-64.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400` with TTL 900. `record_set_count` initializes to 2 (one NS set with 4 values counts as one set, plus one SOA set).

Enforced in: `HostedZoneService.create` inside the zone-creation transaction.

## 2. R2 System records cannot be deleted

Description: The apex NS set and SOA record cannot be deleted, matching real Route 53.

Trigger condition: `DELETE /api/v1/hostedzones/{id}/rrsets/{rid}` where the target row has `is_system=1`.

Error: HTTP 400, code `InvalidChangeBatch`, message `System record of type NS at the zone apex cannot be deleted.` or `System record of type SOA cannot be deleted.` respectively.

Enforced in: `RecordService.delete` before any write.

## 3. R3 Zone delete guarded by HostedZoneNotEmpty

Description: A hosted zone cannot be deleted while it contains any non-system record.

Trigger condition: `DELETE /api/v1/hostedzones/{id}` when `COUNT(records WHERE hosted_zone_id AND is_system=0) > 0`.

Error: HTTP 400, code `HostedZoneNotEmpty`, message `Hosted Zone is not empty. Delete all non-default record sets before deleting the hosted zone.`

Enforced in: `HostedZoneService.delete`.

## 4. R4 CNAME coexistence

Description: A CNAME cannot coexist with any other record type at the same name, and no other type can be created at a name already holding a CNAME (apex NS/SOA excluded from this check only for their own names; in practice CNAME at apex is still rejected by R5 zone rules when conflicting).

Trigger condition: create/update where `type=CNAME` and another set exists at the same name with a different type, or where `type≠CNAME` and a CNAME exists at the same name.

Error: HTTP 400, code `InvalidChangeBatch`, message `RRSet of type CNAME with DNS name X. is not permitted because a conflicting RRSet exists.` where `X.` is the normalized name.

Enforced in: `RecordService.create` and `RecordService.update`.

## 5. R5 Name normalization and zone membership

Description: Record names normalize to lowercase fully-qualified names with a trailing dot and must be within the zone's domain. Bare `@` maps to the apex; relative names get the zone suffix appended.

Trigger condition: any record create/update. Normalization steps: trim, lowercase, convert `@` to zone name, append `.zone-name.` if no dot, append trailing dot if missing. Then verify `name == zone OR name endswith .zone`.

Error: HTTP 400, code `InvalidChangeBatch`, message `RRSet with DNS name X. is not permitted in zone Y.` where `X.` is the submitted normalized name and `Y.` the zone name.

Enforced in: domain helper `normalize_record_name`, called first in the service rule chain; zone names normalized identically at zone creation.

## 6. R6 TTL vs alias

Description: TTL is required for non-alias records and forbidden on alias records.

Trigger condition: create/update where `is_alias=false` and `ttl` missing/out of range, or `is_alias=true` and `ttl` present, or `is_alias=true` with missing `alias_target`.

Errors: HTTP 400, code `InvalidChangeBatch`, messages `TTL is required for non-alias records.`, `Alias records must not specify TTL.`, `AliasTarget is required for alias records.` respectively.

Enforced in: `RecordService` validation step after normalization.

## 7. R7 Per-type value validation

Description: Each value row is validated against its type's wire format.

Trigger condition: create/update/import for any record type.

| Type | Rule | Error message suffix |
|------|------|---------------------|
| A | Valid IPv4 dotted quad | `Value X is not a valid IPv4 address.` |
| AAAA | Valid IPv6 | `Value X is not a valid IPv6 address.` |
| CNAME | Single hostname, FQDN | `Value X is not a valid hostname.` |
| NS/PTR | Hostname | `Value X is not a valid hostname.` |
| MX | `<priority 0-65535> <hostname>` | `MX value must be in the format "<priority> <hostname>".` |
| SRV | `<priority> <weight> <port> <target>` all numeric ranges | `SRV value must be in the format "<priority> <weight> <port> <target>".` |
| CAA | `<flags 0-255> <tag> <value>` tag in issue/issuewild/issuemail/def_spki | `CAA value must be in the format "<flags> <tag> <value>".` |
| TXT | Each string quoted, max 255 chars per string | `TXT strings must be quoted with max 255 characters per string.` |
| SPF | Same quoting rule as TXT | Same as TXT |
| NAPTR | Six space-separated fields | `NAPTR value is malformed.` |
| DS | `<keytag> <algorithm> <digesttype> <digest hex>` | `DS value is malformed.` |
| SOA | Managed only; direct create rejected | `SOA records are managed automatically and cannot be created directly.` |

All wrapped as HTTP 400 code `InvalidChangeBatch`. Empty value list on non-alias records is rejected with `At least one value is required for non-alias records.`

Enforced in: `RecordService` per-type validators plus Zod mirrors on the frontend for instant feedback (backend remains authoritative).

## 8. R8 Set-identifier for non-simple routing

Description: Non-simple routing policies require a `set_identifier` unique within `(name, type)`.

Trigger condition: create/update with `routing_policy ≠ simple` and missing/blank `set_identifier`, or a duplicate `(hosted_zone_id, name, type, set_identifier)`.

Errors: HTTP 400, code `InvalidChangeBatch`, messages `SetIdentifier is required for non-simple routing policies.` and `A record set with name X., type T, and identifier I already exists.`

Enforced in: `RecordService`; uniqueness also backed by the DB UNIQUE constraint.

## 9. R9 Duplicate zone names

Description: Duplicate zone name for the same account and type is rejected.

Trigger condition: `POST /api/v1/hostedzones` with `(owner_user_id, name, type)` already present after normalization.

Error: HTTP 409, code `HostedZoneAlreadyExists`, message `A hosted zone with name X. and type T already exists for this account.`

Enforced in: `HostedZoneService.create`; backed by DB UNIQUE.

## 10. R10 Comment length

Description: Zone comment (Description field) max 256 characters.

Trigger condition: create/patch with comment longer than 256 chars.

Error: HTTP 400, code `InvalidInput`, message `Description must be 256 characters or fewer.`

Enforced in: Pydantic schema (`max_length=256`) and Zod schema; DB CHECK as backstop.

## 11. R11 Change-batch status simulation

Description: Every record mutation returns a change ID with status PENDING, flipping to INSYNC without a background worker.

Trigger condition: any record create/update/delete/batch/import.

Behaviour: service inserts `change_batches(status=PENDING, submitted_at=now)` plus item snapshots in the same transaction and returns `{Id, Status: PENDING, SubmittedAt}`. `GET /api/v1/changes/{id}` returns `INSYNC` when `now - submitted_at ≥ 60 s`, else `PENDING`. Stored status is updated lazily on read.

Enforced in: `RecordService` write methods + `ChangeService.get`.

## 12. Error envelope

All errors, matching AWS, use this shape with HTTP status mapped per rule:

```json
{
  "Error": { "Type": "Sender", "Code": "<AwsErrorCode>", "Message": "<human message>" },
  "RequestId": "<uuid>"
}
```

`Type` is always `Sender` for client errors and `Receiver` for 500s. `RequestId` is a fresh UUID per response, logged server-side with the traceback for 500s.
