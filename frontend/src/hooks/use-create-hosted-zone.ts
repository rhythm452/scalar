import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { CreateHostedZonePayload, HostedZoneCreateResponse } from "@/types/hosted-zone";

export function useCreateHostedZone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHostedZonePayload) =>
      apiFetch<HostedZoneCreateResponse>("/hostedzones", { method: "POST", body: payload }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: create/update/delete zone.
      await queryClient.invalidateQueries({ queryKey: keys.hostedZones() });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
