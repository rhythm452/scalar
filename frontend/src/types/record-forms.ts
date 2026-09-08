import { z } from "zod";

// Client-side mirror of docs/ROUTE53-DOMAIN-RULES.md R5-R8 and
// backend/app/core/rdata.py's per-type validators (R7); the backend
// (app/services/record.py) remains authoritative -- this only gives
// instant feedback before the round trip (docs/ARCHITECTURE.md §4).

export const RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "NS",
  "PTR",
  "SRV",
  "CAA",
  "SOA",
  "NAPTR",
  "SPF",
  "DS",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const ROUTING_POLICIES = [
  "simple",
  "weighted",
  "latency",
  "failover",
  "geolocation",
  "multivalue",
] as const;
export type RoutingPolicy = (typeof ROUTING_POLICIES)[number];

export const ROUTING_POLICY_LABELS: Record<RoutingPolicy, string> = {
  simple: "Simple",
  weighted: "Weighted",
  latency: "Latency",
  failover: "Failover",
  geolocation: "Geolocation",
  multivalue: "Multivalue answer",
};

const TTL_MIN = 1;
const TTL_MAX = 2147483647;
const U16_MAX = 65535;

const HOSTNAME_PATTERN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?\.?$/i;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CAA_TAGS = ["issue", "issuewild", "issuemail", "def_spki"];

function isValidIpv4(value: string): boolean {
  const match = IPV4_PATTERN.exec(value);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

function isValidIpv6(value: string): boolean {
  // Lightweight client mirror: delegate the authoritative check to the
  // browser's own IPv6 parser via the URL constructor's host validation.
  try {
    return new URL(`http://[${value}]`).hostname === `[${value}]`.toLowerCase();
  } catch {
    return false;
  }
}

function isInRange(token: string | undefined, low: number, high: number): boolean {
  if (token === undefined || token === "") return false;
  if (!/^\d+$/.test(token)) return false;
  const n = Number(token);
  return n >= low && n <= high;
}

/** Per-type value-line validation. Returns an error message, or null if valid. */
export function validateRecordValue(type: RecordType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Value cannot be blank.";
  switch (type) {
    case "A":
      return isValidIpv4(trimmed) ? null : `Value ${trimmed} is not a valid IPv4 address.`;
    case "AAAA":
      return isValidIpv6(trimmed) ? null : `Value ${trimmed} is not a valid IPv6 address.`;
    case "CNAME":
    case "NS":
    case "PTR":
      return HOSTNAME_PATTERN.test(trimmed) ? null : `Value ${trimmed} is not a valid hostname.`;
    case "MX": {
      const fields = trimmed.split(/\s+/);
      if (fields.length !== 2 || !isInRange(fields[0], 0, U16_MAX) || !HOSTNAME_PATTERN.test(fields[1] ?? "")) {
        return 'MX value must be in the format "<priority> <hostname>".';
      }
      return null;
    }
    case "SRV": {
      const fields = trimmed.split(/\s+/);
      const ok =
        fields.length === 4 &&
        isInRange(fields[0], 0, U16_MAX) &&
        isInRange(fields[1], 0, U16_MAX) &&
        isInRange(fields[2], 0, U16_MAX) &&
        (fields[3] === "." || HOSTNAME_PATTERN.test(fields[3] ?? ""));
      return ok ? null : 'SRV value must be in the format "<priority> <weight> <port> <target>".';
    }
    case "CAA": {
      const fields = trimmed.split(/\s+/, 3);
      const ok =
        fields.length === 3 &&
        isInRange(fields[0], 0, 255) &&
        CAA_TAGS.includes((fields[1] ?? "").toLowerCase());
      return ok ? null : 'CAA value must be in the format "<flags> <tag> <value>".';
    }
    case "TXT":
    case "SPF": {
      const quoted = /^"([^"\\]|\\.)*"(\s+"([^"\\]|\\.)*")*$/;
      if (!quoted.test(trimmed)) {
        return "TXT strings must be quoted with max 255 characters per string.";
      }
      const overLong = trimmed
        .match(/"([^"\\]|\\.)*"/g)
        ?.some((chunk) => chunk.slice(1, -1).length > 255);
      return overLong ? "TXT strings must be quoted with max 255 characters per string." : null;
    }
    case "NAPTR": {
      const fields = trimmed.split(/\s+/);
      return fields.length === 6 ? null : "NAPTR value is malformed.";
    }
    case "DS": {
      const fields = trimmed.split(/\s+/);
      const ok =
        fields.length === 4 &&
        isInRange(fields[0], 0, U16_MAX) &&
        isInRange(fields[1], 0, 255) &&
        isInRange(fields[2], 0, 255) &&
        /^[0-9a-fA-F]+$/.test(fields[3] ?? "") &&
        (fields[3]?.length ?? 0) >= 4 &&
        (fields[3]?.length ?? 0) % 2 === 0;
      return ok ? null : "DS value is malformed.";
    }
    case "SOA":
      return "SOA records are managed automatically and cannot be created directly.";
    default:
      return null;
  }
}

export const recordFormSchema = z
  .object({
    subdomain: z.string(),
    type: z.enum(RECORD_TYPES),
    isAlias: z.boolean(),
    aliasTarget: z.string(),
    aliasHostedZoneId: z.string(),
    aliasEvaluateTargetHealth: z.boolean(),
    ttl: z.string(),
    routingPolicy: z.enum(ROUTING_POLICIES),
    setIdentifier: z.string(),
    weight: z.string(),
    region: z.string(),
    failover: z.enum(["PRIMARY", "SECONDARY", ""]),
    geoContinent: z.string(),
    geoCountry: z.string(),
    geoSubdivision: z.string(),
    valuesText: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.isAlias) {
      if (!values.aliasTarget.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["aliasTarget"],
          message: "AliasTarget is required for alias records.",
        });
      }
    } else {
      if (!isInRange(values.ttl, TTL_MIN, TTL_MAX)) {
        ctx.addIssue({
          code: "custom",
          path: ["ttl"],
          message: "TTL is required for non-alias records.",
        });
      }
      const lines = values.valuesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["valuesText"],
          message: "At least one value is required for non-alias records.",
        });
      } else if (values.type === "CNAME" && lines.length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["valuesText"],
          message: "CNAME record sets must contain exactly one value.",
        });
      } else {
        for (const line of lines) {
          const error = validateRecordValue(values.type, line);
          if (error) {
            ctx.addIssue({ code: "custom", path: ["valuesText"], message: error });
            break;
          }
        }
      }
    }

    if (values.routingPolicy !== "simple" && !values.setIdentifier.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["setIdentifier"],
        message: "SetIdentifier is required for non-simple routing policies.",
      });
    }
    if (values.routingPolicy === "weighted" && !isInRange(values.weight, 0, U16_MAX)) {
      ctx.addIssue({ code: "custom", path: ["weight"], message: "Weight must be 0 or greater." });
    }
    if (values.routingPolicy === "latency" && !values.region.trim()) {
      ctx.addIssue({ code: "custom", path: ["region"], message: "Region is required for latency routing." });
    }
    if (values.routingPolicy === "failover" && !values.failover) {
      ctx.addIssue({
        code: "custom",
        path: ["failover"],
        message: "Failover record type is required for failover routing.",
      });
    }
    if (
      values.routingPolicy === "geolocation" &&
      !values.geoContinent.trim() &&
      !values.geoCountry.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["geoCountry"],
        message: "Continent or country is required for geolocation routing.",
      });
    }
  });

export type RecordFormValues = z.infer<typeof recordFormSchema>;

// Quick create supports "Add another record" (Part C): one or more records
// submitted together through the batch endpoint.
export const quickCreateFormSchema = z.object({
  records: z.array(recordFormSchema).min(1),
});
export type QuickCreateFormValues = z.infer<typeof quickCreateFormSchema>;

export function defaultRecordFormValues(overrides: Partial<RecordFormValues> = {}): RecordFormValues {
  return {
    subdomain: "",
    type: "A",
    isAlias: false,
    aliasTarget: "",
    aliasHostedZoneId: "",
    aliasEvaluateTargetHealth: false,
    ttl: "300",
    routingPolicy: "simple",
    setIdentifier: "",
    weight: "",
    region: "",
    failover: "",
    geoContinent: "",
    geoCountry: "",
    geoSubdivision: "",
    valuesText: "",
    ...overrides,
  };
}

/** Builds the full, zone-qualified record name from the subdomain input, matching
 * backend/app/core/dns_names.py's normalisation preview (R5): blank means apex. */
export function previewRecordName(subdomain: string, zoneName: string): string {
  const trimmed = subdomain.trim().toLowerCase();
  if (!trimmed || trimmed === "@") return zoneName;
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.${zoneName}`;
}

export function recordFormToPayload(values: RecordFormValues, zoneName: string) {
  const name = previewRecordName(values.subdomain, zoneName);
  const isAlias = values.isAlias;
  return {
    name,
    type: values.type,
    ttl: isAlias ? null : Number(values.ttl),
    routing_policy: values.routingPolicy,
    set_identifier: values.routingPolicy === "simple" ? null : values.setIdentifier.trim() || null,
    weight: values.routingPolicy === "weighted" ? Number(values.weight) : null,
    region: values.routingPolicy === "latency" ? values.region.trim() || null : null,
    failover: values.routingPolicy === "failover" ? (values.failover as "PRIMARY" | "SECONDARY") : null,
    geo_continent: values.routingPolicy === "geolocation" ? values.geoContinent.trim() || null : null,
    geo_country: values.routingPolicy === "geolocation" ? values.geoCountry.trim() || null : null,
    geo_subdivision: values.routingPolicy === "geolocation" ? values.geoSubdivision.trim() || null : null,
    is_alias: isAlias,
    alias_target: isAlias ? values.aliasTarget.trim() || null : null,
    alias_hosted_zone_id: isAlias ? values.aliasHostedZoneId.trim() || null : null,
    alias_evaluate_target_health: isAlias ? values.aliasEvaluateTargetHealth : false,
    values: isAlias
      ? []
      : values.valuesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
  };
}

/** Reverse of recordFormToPayload, for prefilling the edit SplitPanel. */
export function recordToFormValues(
  record: {
    name: string;
    ttl: number | null;
    routing_policy: string;
    set_identifier: string | null;
    weight: number | null;
    region: string | null;
    failover: "PRIMARY" | "SECONDARY" | null;
    geo_continent: string | null;
    geo_country: string | null;
    geo_subdivision: string | null;
    is_alias: boolean;
    alias_target: string | null;
    alias_hosted_zone_id: string | null;
    alias_evaluate_target_health: boolean | null;
    values: string[];
  },
  zoneName: string,
  type: RecordType,
): RecordFormValues {
  const subdomain = record.name === zoneName ? "" : record.name.slice(0, -(zoneName.length + 1));
  return defaultRecordFormValues({
    subdomain,
    type,
    isAlias: record.is_alias,
    aliasTarget: record.alias_target ?? "",
    aliasHostedZoneId: record.alias_hosted_zone_id ?? "",
    aliasEvaluateTargetHealth: record.alias_evaluate_target_health ?? false,
    ttl: record.ttl !== null ? String(record.ttl) : "300",
    routingPolicy: (record.routing_policy as RoutingPolicy) ?? "simple",
    setIdentifier: record.set_identifier ?? "",
    weight: record.weight !== null ? String(record.weight) : "",
    region: record.region ?? "",
    failover: record.failover ?? "",
    geoContinent: record.geo_continent ?? "",
    geoCountry: record.geo_country ?? "",
    geoSubdivision: record.geo_subdivision ?? "",
    valuesText: record.values.join("\n"),
  });
}
