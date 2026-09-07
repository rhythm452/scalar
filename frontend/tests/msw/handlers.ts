import { http, HttpResponse } from "msw";
import type { ErrorEnvelope } from "@/types/api-error";
import type { DashboardSummary } from "@/types/dashboard";
import type { LoginResponse, LogoutResponse, UserOut } from "@/types/user";

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
];
