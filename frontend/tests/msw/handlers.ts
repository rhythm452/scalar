import { http, HttpResponse } from "msw";
import type { ErrorEnvelope } from "@/types/api-error";
import type { DashboardSummary } from "@/types/dashboard";
import type { LoginResponse, LogoutResponse, UserOut } from "@/types/user";
import type { HostedZoneDetail, HostedZoneListItem } from "@/types/hosted-zone";
import type {
  BatchRequest,
  BatchResponse,
  BatchResultItem,
  ChangeSummary,
  RecordDeleteResponse,
  RecordItem,
  RecordSetWritePayload,
  RecordWriteResponse,
} from "@/types/record";
import type { TagItem } from "@/types/tag";

// Path-only patterns: apiFetch calls same-origin-relative paths ("/api/v1/...", per
// ADR-013), and Vitest's jsdom default origin is http://localhost:3000, not :8000 --
// a handler registered against a literal http://localhost:8000 origin would never
// match. See docs/TESTING.md §3.
export const VALID_USER: UserOut = {
  id: "usr_1",
  username: "admin",
  email: "admin@example.com",
  display_name: "Admin User",
  aws_account_id: "123456789012",
};

function unauthorizedEnvelope(message: string): ErrorEnvelope {
  return {
    Error: { Type: "Sender", Code: "NotAuthorized", Message: message },
    RequestId: "test-request-id",
  };
}

function errorEnvelope(code: string, message: string): ErrorEnvelope {
  return { Error: { Type: "Sender", Code: code, Message: message }, RequestId: "test-request-id" };
}

export const EMPTY_ZONE: HostedZoneDetail = {
  id: "zone_empty",
  name: "empty.example.com.",
  comment: "Demo zone",
  type: "public",
  vpc_id: null,
  vpc_region: null,
  record_set_count: 2,
  caller_reference: "ref-empty",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const NON_EMPTY_ZONE: HostedZoneDetail = {
  ...EMPTY_ZONE,
  id: "zone_full",
  name: "full.example.com.",
  record_set_count: 3,
};

const ZONES_BY_ID: Record<string, HostedZoneDetail> = {
  [EMPTY_ZONE.id]: EMPTY_ZONE,
  [NON_EMPTY_ZONE.id]: NON_EMPTY_ZONE,
};

let tagsByZone: Record<string, TagItem[]> = { [EMPTY_ZONE.id]: [], [NON_EMPTY_ZONE.id]: [] };

const ZONE_LIST_ITEMS: HostedZoneListItem[] = [EMPTY_ZONE, NON_EMPTY_ZONE].map(
  ({ id, name, comment, type, record_set_count, caller_reference, created_at }) => ({
    id,
    name,
    comment,
    type,
    record_set_count,
    caller_reference,
    created_at,
  }),
);

function baseRecord(overrides: Partial<RecordItem> & Pick<RecordItem, "id" | "name" | "type">): RecordItem {
  return {
    ttl: 300,
    routing_policy: "simple",
    set_identifier: null,
    weight: null,
    region: null,
    failover: null,
    geo_continent: null,
    geo_country: null,
    geo_subdivision: null,
    values: [],
    is_alias: false,
    alias_target: null,
    alias_hosted_zone_id: null,
    alias_evaluate_target_health: null,
    is_system: false,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

let recordsByZone: Record<string, RecordItem[]> = {
  [NON_EMPTY_ZONE.id]: [
    baseRecord({ id: "rec_1", name: "full.example.com.", type: "A", values: ["192.0.2.1"] }),
    baseRecord({
      id: "rec_ns",
      name: "full.example.com.",
      type: "NS",
      ttl: 172800,
      values: ["ns-2048.awsdns-64.com."],
      is_system: true,
    }),
    baseRecord({
      id: "rec_cname",
      name: "existing-cname.full.example.com.",
      type: "CNAME",
      values: ["target.example.com."],
    }),
  ],
  [EMPTY_ZONE.id]: [],
};
let nextRecordId = 100;

export const handlers = [
  http.post("/api/v1/auth/login", async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string };
    if (body.username === "admin" && body.password === "password123") {
      const response: LoginResponse = {
        user: VALID_USER,
        session: { expires_at: "2099-01-01T00:00:00Z" },
      };
      return HttpResponse.json(response, { status: 200 });
    }
    return HttpResponse.json(unauthorizedEnvelope("Invalid username or password."), {
      status: 401,
    });
  }),

  http.post("/api/v1/auth/logout", () => {
    const response: LogoutResponse = { ok: true };
    return HttpResponse.json(response, { status: 200 });
  }),

  // Logged-out by default; tests that need an authed session override with server.use(...).
  http.get("/api/v1/auth/session", () => {
    return HttpResponse.json(unauthorizedEnvelope("No active session."), { status: 401 });
  }),

  http.get("/api/v1/dashboard/summary", () => {
    const response: DashboardSummary = { zones: 3, records: 42, health_checks: 0, traffic_policies: 0 };
    return HttpResponse.json(response, { status: 200 });
  }),

  http.get("/api/v1/hostedzones", ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const items = ZONE_LIST_ITEMS.filter(
      (zone) => (!type || zone.type === type) && zone.name.toLowerCase().includes(search),
    );
    return HttpResponse.json({ items, next_token: null }, { status: 200 });
  }),

  http.post("/api/v1/hostedzones", async ({ request }) => {
    const body = (await request.json()) as { name: string; type: string; comment?: string | null };
    if (ZONE_LIST_ITEMS.some((zone) => zone.name === `${body.name}.`)) {
      return HttpResponse.json(
        errorEnvelope("HostedZoneAlreadyExists", `A hosted zone with name ${body.name}. already exists.`),
        { status: 409 },
      );
    }
    const zone: HostedZoneDetail = {
      ...EMPTY_ZONE,
      id: "zone_new",
      name: `${body.name}.`,
      comment: body.comment ?? null,
      type: body.type as HostedZoneDetail["type"],
    };
    return HttpResponse.json({ zone, change: null }, { status: 201 });
  }),

  http.get("/api/v1/hostedzones/:id", ({ params }) => {
    const zone = ZONES_BY_ID[params.id as string];
    if (!zone) {
      return HttpResponse.json(errorEnvelope("NoSuchHostedZone", "No such hosted zone."), { status: 404 });
    }
    return HttpResponse.json({ zone, tags: tagsByZone[zone.id] ?? [] }, { status: 200 });
  }),

  http.patch("/api/v1/hostedzones/:id", async ({ params, request }) => {
    const zone = ZONES_BY_ID[params.id as string];
    if (!zone) {
      return HttpResponse.json(errorEnvelope("NoSuchHostedZone", "No such hosted zone."), { status: 404 });
    }
    const body = (await request.json()) as { comment: string | null };
    ZONES_BY_ID[zone.id] = { ...zone, comment: body.comment };
    return HttpResponse.json({ zone: ZONES_BY_ID[zone.id] }, { status: 200 });
  }),

  http.delete("/api/v1/hostedzones/:id", ({ params }) => {
    const zone = ZONES_BY_ID[params.id as string];
    if (!zone) {
      return HttpResponse.json(errorEnvelope("NoSuchHostedZone", "No such hosted zone."), { status: 404 });
    }
    if ((recordsByZone[zone.id] ?? []).length > 0) {
      return HttpResponse.json(
        errorEnvelope(
          "HostedZoneNotEmpty",
          "Hosted Zone is not empty. Delete all non-default record sets before deleting the hosted zone.",
        ),
        { status: 400 },
      );
    }
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),

  http.get("/api/v1/hostedzones/:id/tags", ({ params }) => {
    return HttpResponse.json({ tags: tagsByZone[params.id as string] ?? [] }, { status: 200 });
  }),

  http.put("/api/v1/hostedzones/:id/tags", async ({ params, request }) => {
    const body = (await request.json()) as { tags: TagItem[] };
    tagsByZone = { ...tagsByZone, [params.id as string]: body.tags };
    return HttpResponse.json({ tags: body.tags }, { status: 200 });
  }),

  http.get("/api/v1/hostedzones/:id/rrsets", ({ params }) => {
    const items = recordsByZone[params.id as string] ?? [];
    return HttpResponse.json({ items, next_token: null }, { status: 200 });
  }),

  http.post("/api/v1/hostedzones/:id/rrsets", async ({ params, request }) => {
    const zoneId = params.id as string;
    const body = (await request.json()) as RecordSetWritePayload;
    const result = applyCreate(zoneId, body);
    if ("Error" in result) return HttpResponse.json(result, { status: 400 });
    return HttpResponse.json(
      { record: result.record, change: result.change } satisfies RecordWriteResponse,
      { status: 201 },
    );
  }),

  http.put("/api/v1/hostedzones/:id/rrsets/:rid", async ({ params, request }) => {
    const zoneId = params.id as string;
    const recordId = params.rid as string;
    const body = (await request.json()) as RecordSetWritePayload;
    const items = recordsByZone[zoneId] ?? [];
    const existing = items.find((item) => item.id === recordId);
    if (!existing) {
      return HttpResponse.json(errorEnvelope("NoSuchRecord", "No such record."), { status: 404 });
    }
    const result = applyCreate(zoneId, body, { replaceId: recordId });
    if ("Error" in result) return HttpResponse.json(result, { status: 400 });
    return HttpResponse.json(
      { record: result.record, change: result.change } satisfies RecordWriteResponse,
      { status: 200 },
    );
  }),

  http.delete("/api/v1/hostedzones/:id/rrsets/:rid", ({ params }) => {
    const zoneId = params.id as string;
    const recordId = params.rid as string;
    const items = recordsByZone[zoneId] ?? [];
    const existing = items.find((item) => item.id === recordId);
    if (!existing) {
      return HttpResponse.json(errorEnvelope("NoSuchRecord", "No such record."), { status: 404 });
    }
    if (existing.is_system) {
      return HttpResponse.json(
        errorEnvelope(
          "InvalidChangeBatch",
          `System record of type ${existing.type} at the zone apex cannot be deleted.`,
        ),
        { status: 400 },
      );
    }
    recordsByZone = { ...recordsByZone, [zoneId]: items.filter((item) => item.id !== recordId) };
    return HttpResponse.json(
      { change: fakeChange() } satisfies RecordDeleteResponse,
      { status: 200 },
    );
  }),

  http.post("/api/v1/hostedzones/:id/rrsets/batch", async ({ params, request }) => {
    const zoneId = params.id as string;
    const body = (await request.json()) as BatchRequest;
    const before = recordsByZone[zoneId] ?? [];
    const results: BatchResultItem[] = [];
    for (const change of body.changes) {
      if (change.action === "DELETE") {
        const target = before.find((item) => item.id === change.record_id);
        if (!target) {
          return HttpResponse.json(errorEnvelope("NoSuchRecord", "No such record."), { status: 404 });
        }
        if (target.is_system) {
          return HttpResponse.json(
            errorEnvelope(
              "InvalidChangeBatch",
              `System record of type ${target.type} at the zone apex cannot be deleted.`,
            ),
            { status: 400 },
          );
        }
        results.push({ action: "DELETE", record_id: target.id, error: null });
      } else if (change.record) {
        const invalid = validateRecord(zoneId, change.record);
        if (invalid) return HttpResponse.json(invalid, { status: 400 });
        results.push({ action: change.action, record_id: null, error: null });
      }
    }
    // All validated: apply for real, atomically, matching the backend's
    // rollback-on-any-failure contract (docs/API.md §4).
    for (const change of body.changes) {
      if (change.action === "DELETE" && change.record_id) {
        recordsByZone = {
          ...recordsByZone,
          [zoneId]: (recordsByZone[zoneId] ?? []).filter((item) => item.id !== change.record_id),
        };
      } else if (change.record) {
        applyCreate(zoneId, change.record);
      }
    }
    return HttpResponse.json(
      { change: fakeChange(), results } satisfies BatchResponse,
      { status: 200 },
    );
  }),
];

function fakeChange(): ChangeSummary {
  return { id: `C${Math.random().toString(36).slice(2, 12).toUpperCase()}`, status: "PENDING", submitted_at: new Date().toISOString() };
}

/** Minimal in-memory simulation of RecordService's rule chain (R4, R6) for
 * MSW-backed component tests -- not a reimplementation of the backend, just
 * enough to exercise the field-error-mapping paths under test. */
function validateRecord(
  zoneId: string,
  body: RecordSetWritePayload,
  replaceId?: string,
): ErrorEnvelope | null {
  const items = recordsByZone[zoneId] ?? [];
  const conflict = items.find(
    (item) =>
      item.id !== replaceId &&
      item.name === body.name &&
      ((body.type === "CNAME" && item.type !== "CNAME") ||
        (body.type !== "CNAME" && item.type === "CNAME")),
  );
  if (conflict) {
    return errorEnvelope(
      "InvalidChangeBatch",
      `RRSet of type ${body.type} with DNS name ${body.name} is not permitted because a conflicting RRSet exists.`,
    );
  }
  if (!body.is_alias && (body.ttl === null || body.ttl === undefined)) {
    return errorEnvelope("InvalidChangeBatch", "TTL is required for non-alias records.");
  }
  if (body.is_alias && !body.alias_target) {
    return errorEnvelope("InvalidChangeBatch", "AliasTarget is required for alias records.");
  }
  if (!body.is_alias && body.values.length === 0) {
    return errorEnvelope("InvalidChangeBatch", "At least one value is required for non-alias records.");
  }
  return null;
}

function applyCreate(
  zoneId: string,
  body: RecordSetWritePayload,
  opts: { replaceId?: string } = {},
): { record: RecordItem; change: ChangeSummary } | ErrorEnvelope {
  const invalid = validateRecord(zoneId, body, opts.replaceId);
  if (invalid) return invalid;
  const items = recordsByZone[zoneId] ?? [];
  const record: RecordItem = {
    id: opts.replaceId ?? `rec_${nextRecordId++}`,
    name: body.name,
    type: body.type,
    ttl: body.ttl,
    routing_policy: body.routing_policy,
    set_identifier: body.set_identifier,
    weight: body.weight,
    region: body.region,
    failover: body.failover,
    geo_continent: body.geo_continent,
    geo_country: body.geo_country,
    geo_subdivision: body.geo_subdivision,
    values: body.values,
    is_alias: body.is_alias,
    alias_target: body.alias_target,
    alias_hosted_zone_id: body.alias_hosted_zone_id,
    alias_evaluate_target_health: body.alias_evaluate_target_health,
    is_system: false,
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
  };
  recordsByZone = {
    ...recordsByZone,
    [zoneId]: opts.replaceId
      ? items.map((item) => (item.id === opts.replaceId ? record : item))
      : [...items, record],
  };
  return { record, change: fakeChange() };
}
