import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { BatchRequest, BatchResponse } from "@/types/record";

// Bulk delete goes through the batch endpoint: it is atomic, so a single
// record that can't be deleted (e.g. concurrently removed) rolls the whole
// selection back rather than deleting only some of it (docs/API.md §4).
export function useBulkDeleteRecords(zoneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => {
      const body: BatchRequest = {
        changes: recordIds.map((record_id) => ({ action: "DELETE", record_id })),
      };
      return apiFetch<BatchResponse>(`/hostedzones/${zoneId}/rrsets/batch`, {
        method: "POST",
        body,
      });
    },
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: create/update/delete record.
      await queryClient.invalidateQueries({ queryKey: keys.records(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.zone(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
