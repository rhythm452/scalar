import Badge from "@cloudscape-design/components/badge";
import type { HostedZoneType } from "@/types/hosted-zone";

export function ZoneTypeBadge({ type }: { type: HostedZoneType }) {
  return (
    <Badge color={type === "public" ? "blue" : "grey"}>
      {type === "public" ? "Public" : "Private"}
    </Badge>
  );
}
