import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { buildLoginRedirectUrl, isPublicPath, pageAuthGuard } from "@/proxy/auth-guard";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats / (the marketing landing page) as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("treats every other path as protected", () => {
    expect(isPublicPath("/route53")).toBe(false);
    expect(isPublicPath("/marketing")).toBe(false);
  });
});

describe("buildLoginRedirectUrl", () => {
  it("preserves the original path and query in the next param", () => {
    const url = buildLoginRedirectUrl(new URL("https://example.com/route53/hostedzones?tab=records"));
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/route53/hostedzones?tab=records");
  });
});

describe("pageAuthGuard", () => {
  it("allows /login through with no cookie", () => {
    const request = new NextRequest(new URL("https://example.com/login"));
    const response = pageAuthGuard(request);
    expect(response.status).toBe(200);
  });

  it("allows / through with no cookie", () => {
    const request = new NextRequest(new URL("https://example.com/"));
    const response = pageAuthGuard(request);
    expect(response.status).toBe(200);
  });

  it("redirects to /login when the session cookie is absent", () => {
    const request = new NextRequest(new URL("https://example.com/route53"));
    const response = pageAuthGuard(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Froute53");
  });

  it("allows the request through when the session cookie is present", () => {
    const request = new NextRequest(new URL("https://example.com/route53"), {
      headers: { cookie: `${SESSION_COOKIE_NAME}=abc123` },
    });
    const response = pageAuthGuard(request);
    expect(response.status).toBe(200);
  });
});
