import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { RecordSetWritePayload, RecordWriteResponse } from "@/types/record";

export function useUpdateRecord(zoneId: string, recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RecordSetWritePayload) =>
      apiFetch<RecordWriteResponse>(`/hostedzones/${zoneId}/rrsets/${recordId}`, {
        method: "PUT",
        body: payload,
      }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: create/update/delete record.
      await queryClient.invalidateQueries({ queryKey: keys.records(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.zone(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
