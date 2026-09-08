import { http, HttpResponse } from "msw";
import type { ErrorEnvelope } from "@/types/api-error";
import type { DashboardSummary } from "@/types/dashboard";
import type { LoginResponse, LogoutResponse, UserOut } from "@/types/user";
import type { HostedZoneDetail, HostedZoneListItem } from "@/types/hosted-zone";
import type { RecordItem } from "@/types/record";
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

const RECORDS_BY_ZONE: Record<string, RecordItem[]> = {
  [NON_EMPTY_ZONE.id]: [
    {
      id: "rec_1",
      name: "full.example.com.",
      type: "A",
      ttl: 300,
      routing_policy: "simple",
      set_identifier: null,
      values: ["192.0.2.1"],
      is_alias: false,
      alias_target: null,
      is_system: false,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ],
  [EMPTY_ZONE.id]: [],
};

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
    if ((RECORDS_BY_ZONE[zone.id] ?? []).length > 0) {
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
    const items = RECORDS_BY_ZONE[params.id as string] ?? [];
    return HttpResponse.json({ items, next_token: null }, { status: 200 });
  }),
];
