import { describe, expect, it } from "vitest";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";
import { sanitizeNextParam } from "@/lib/safe-redirect";

describe("sanitizeNextParam", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeNextParam("/route53/hostedzones")).toBe("/route53/hostedzones");
  });

  it.each([undefined, "", "//evil.com", "https://evil.com", "evil.com"])(
    "falls back to the default path for unsafe input: %s",
    (input) => {
      expect(sanitizeNextParam(input)).toBe(DEFAULT_AUTHENTICATED_PATH);
    },
  );
});
