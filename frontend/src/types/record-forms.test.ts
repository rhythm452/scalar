import { describe, expect, it } from "vitest";
import {
  defaultRecordFormValues,
  previewRecordName,
  recordFormSchema,
  recordFormToPayload,
  validateRecordValue,
} from "@/types/record-forms";

describe("previewRecordName", () => {
  it("returns the zone apex for a blank subdomain", () => {
    expect(previewRecordName("", "example.com.")).toBe("example.com.");
    expect(previewRecordName("@", "example.com.")).toBe("example.com.");
  });

  it("appends the zone suffix to a relative subdomain", () => {
    expect(previewRecordName("www", "example.com.")).toBe("www.example.com.");
  });
});

describe("validateRecordValue", () => {
  it.each([
    ["A", "192.0.2.1", null],
    ["A", "999.0.2.1", "Value 999.0.2.1 is not a valid IPv4 address."],
    ["CNAME", "target.example.com.", null],
    ["MX", "10 mail.example.com.", null],
    ["MX", "not-a-priority mail.example.com.", 'MX value must be in the format "<priority> <hostname>".'],
    ["SRV", "10 60 5060 sip.example.com.", null],
    ["CAA", '0 issue "letsencrypt.org"', null],
    ["CAA", "0 badtag value", 'CAA value must be in the format "<flags> <tag> <value>".'],
    ["TXT", '"v=spf1 -all"', null],
    ["TXT", "unquoted", "TXT strings must be quoted with max 255 characters per string."],
    ["SOA", "anything", "SOA records are managed automatically and cannot be created directly."],
  ] as const)("%s value %s -> %s", (type, value, expected) => {
    expect(validateRecordValue(type, value)).toBe(expected);
  });
});

describe("recordFormSchema", () => {
  it("requires TTL for non-alias records (R6)", () => {
    const result = recordFormSchema.safeParse(defaultRecordFormValues({ ttl: "", valuesText: "192.0.2.1" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("ttl"))).toBe(true);
    }
  });

  it("requires an alias target when isAlias is set (R6)", () => {
    const result = recordFormSchema.safeParse(defaultRecordFormValues({ isAlias: true, aliasTarget: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("aliasTarget"))).toBe(true);
    }
  });

  it("requires a set identifier for non-simple routing (R8)", () => {
    const result = recordFormSchema.safeParse(
      defaultRecordFormValues({ routingPolicy: "weighted", weight: "10", valuesText: "192.0.2.1", setIdentifier: "" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("setIdentifier"))).toBe(true);
    }
  });

  it("accepts a fully valid simple A record", () => {
    const result = recordFormSchema.safeParse(
      defaultRecordFormValues({ subdomain: "www", ttl: "300", valuesText: "192.0.2.1" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects more than one value for a CNAME set", () => {
    const result = recordFormSchema.safeParse(
      defaultRecordFormValues({ type: "CNAME", ttl: "300", valuesText: "a.example.com.\nb.example.com." }),
    );
    expect(result.success).toBe(false);
  });
});

describe("recordFormToPayload", () => {
  it("builds the qualified name and splits values by line", () => {
    const payload = recordFormToPayload(
      defaultRecordFormValues({ subdomain: "www", ttl: "300", valuesText: "192.0.2.1\n192.0.2.2" }),
      "example.com.",
    );
    expect(payload.name).toBe("www.example.com.");
    expect(payload.values).toEqual(["192.0.2.1", "192.0.2.2"]);
    expect(payload.ttl).toBe(300);
  });

  it("omits TTL and values for an alias record", () => {
    const payload = recordFormToPayload(
      defaultRecordFormValues({ isAlias: true, aliasTarget: "target.example.com." }),
      "example.com.",
    );
    expect(payload.ttl).toBeNull();
    expect(payload.values).toEqual([]);
    expect(payload.alias_target).toBe("target.example.com.");
  });
});
