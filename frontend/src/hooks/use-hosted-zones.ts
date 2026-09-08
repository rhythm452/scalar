import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildQueryString } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { HostedZoneListParams, HostedZoneListResponse } from "@/types/hosted-zone";

export function useHostedZones(params: HostedZoneListParams) {
  return useQuery({
    queryKey: keys.hostedZones(params),
    queryFn: () => apiFetch<HostedZoneListResponse>(`/hostedzones${buildQueryString(params)}`),
  });
}
