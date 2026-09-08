import type { ApiError } from "@/lib/error";
import type { RecordFormValues } from "@/types/record-forms";

/** Maps a record-mutation ApiError to the FormField it belongs on, per
 * docs/ROUTE53-DOMAIN-RULES.md. The AWS error envelope carries no field
 * name (docs/ROUTE53-DOMAIN-RULES.md §12), so this pattern-matches the
 * message text the same rule always produces (docs/ARCHITECTURE.md §4.8:
 * "field-level codes to inline FormField errors, record-level codes to an
 * Alert"). Returns null when the message doesn't match a known rule --
 * the caller should fall back to a top-level Alert. */
export function mapRecordErrorToField(error: ApiError): keyof RecordFormValues | null {
  const message = error.message.toLowerCase();

  // R4 CNAME coexistence, R5 name normalization/zone membership.
  if (
    message.includes("is not permitted because a conflicting rrset exists") ||
    message.includes("is not permitted in zone")
  ) {
    return "subdomain";
  }
  // R6 TTL vs alias.
  if (message === "ttl is required for non-alias records.") {
    return "ttl";
  }
  if (message === "alias records must not specify ttl.") {
    return "ttl";
  }
  if (message === "aliastarget is required for alias records.") {
    return "aliasTarget";
  }
  // R7 per-type value validation (and SOA's direct-create rejection).
  if (
    message.startsWith("value ") ||
    message.includes("must be in the format") ||
    message.includes("is malformed") ||
    message.includes("txt strings must be quoted") ||
    message.includes("at least one value is required") ||
    message.includes("cname record sets must contain exactly one value")
  ) {
    return "valuesText";
  }
  if (message.includes("managed automatically and cannot be created directly")) {
    return "type";
  }
  // R8 set-identifier for non-simple routing.
  if (
    message.includes("setidentifier is required") ||
    message.includes("already exists")
  ) {
    return "setIdentifier";
  }
  return null;
}
