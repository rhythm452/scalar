import { describe, expect, it } from "vitest";
import { apiFetch, buildQueryString } from "@/lib/api-client";
import { isApiError } from "@/lib/error";
import type { DashboardSummary } from "@/types/dashboard";

describe("apiFetch", () => {
  it("parses a successful JSON response", async () => {
    const summary = await apiFetch<DashboardSummary>("/dashboard/summary");
    expect(summary.zones).toBe(3);
  });

  it("throws a typed ApiError parsed from the AWS envelope on failure", async () => {
    try {
      await apiFetch("/auth/session");
      expect.unreachable("apiFetch should have thrown");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.status).toBe(401);
        expect(error.code).toBe("NotAuthorized");
        expect(error.message).toBe("No active session.");
      }
    }
  });
});

describe("buildQueryString", () => {
  it("serializes defined params and skips undefined ones", () => {
    expect(buildQueryString({ a: "1", b: 2, c: true, d: undefined })).toBe("?a=1&b=2&c=true");
  });

  it("round-trips an opaque cursor token unmangled", () => {
    const cursor = "eyJzb3J0X3ZhbHVlIjoieCIsImlkIjoxfQ==";
    const query = buildQueryString({ next_token: cursor });
    const parsed = new URLSearchParams(query.slice(1));
    expect(parsed.get("next_token")).toBe(cursor);
  });

  it("returns an empty string when there are no params", () => {
    expect(buildQueryString({})).toBe("");
  });
});
