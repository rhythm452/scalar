import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { HostedZoneGetResponse } from "@/types/hosted-zone";

export function useHostedZone(zoneId: string) {
  return useQuery({
    queryKey: keys.zone(zoneId),
    queryFn: () => apiFetch<HostedZoneGetResponse>(`/hostedzones/${zoneId}`),
    enabled: Boolean(zoneId),
  });
}
