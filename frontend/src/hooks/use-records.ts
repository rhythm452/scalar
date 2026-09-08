import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildQueryString } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { RecordListParams, RecordListResponse } from "@/types/record";

// Read-only: the zone-detail Records tab lists records via GET only in Phase 4.
// Create/edit/delete land in Phase 5 on top of this same query key.
export function useRecords(zoneId: string, params: RecordListParams) {
  return useQuery({
    queryKey: keys.records(zoneId, params),
    queryFn: () =>
      apiFetch<RecordListResponse>(`/hostedzones/${zoneId}/rrsets${buildQueryString(params)}`),
    enabled: Boolean(zoneId),
  });
}
