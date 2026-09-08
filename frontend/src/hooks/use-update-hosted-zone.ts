import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { HostedZoneUpdateResponse } from "@/types/hosted-zone";

export function useUpdateHostedZone(zoneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: string | null) =>
      apiFetch<HostedZoneUpdateResponse>(`/hostedzones/${zoneId}`, {
        method: "PATCH",
        body: { comment },
      }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: create/update/delete zone.
      await queryClient.invalidateQueries({ queryKey: keys.hostedZones() });
      await queryClient.invalidateQueries({ queryKey: keys.zone(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
