import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { OkResponse } from "@/types/common";

export function useDeleteHostedZone(zoneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<OkResponse>(`/hostedzones/${zoneId}`, { method: "DELETE" }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: create/update/delete zone.
      queryClient.removeQueries({ queryKey: keys.zone(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.hostedZones() });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
