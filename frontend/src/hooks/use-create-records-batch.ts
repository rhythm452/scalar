import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { BatchRequest, BatchResponse, RecordSetWritePayload } from "@/types/record";

// Quick create submits every record (one, or several via "Add another record")
// through the batch endpoint so a single bad record rolls the whole submission
// back rather than partially creating records (docs/API.md §4).
export function useCreateRecordsBatch(zoneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (records: RecordSetWritePayload[]) => {
      const body: BatchRequest = {
        changes: records.map((record) => ({ action: "CREATE", record })),
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
