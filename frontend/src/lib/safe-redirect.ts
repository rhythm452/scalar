import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";

// `next` is attacker-controllable query input by the time the login page reads it
// (`/login?next=https://evil.com` or `next=//evil.com`); only same-origin relative
// paths are safe to redirect to.
//
// `/` is not a real route in this app (the dashboard lives under `/route53`), so an
// unauthenticated visit to `/` produces `next=/` via the auth guard — treat that the
// same as "no next param" rather than bouncing the user to a 404 after login.
export function sanitizeNextParam(raw: string | undefined): string {
  if (!raw || raw === "/") {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return raw;
}
