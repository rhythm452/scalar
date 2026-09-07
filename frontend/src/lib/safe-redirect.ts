import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";

// `next` is attacker-controllable query input by the time the login page reads it
// (`/login?next=https://evil.com` or `next=//evil.com`); only same-origin relative
// paths are safe to redirect to.
export function sanitizeNextParam(raw: string | undefined): string {
  if (!raw) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return raw;
}
