import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { TagItem, TagsResponse } from "@/types/tag";

export function useReplaceTags(zoneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tags: TagItem[]) =>
      apiFetch<TagsResponse>(`/hostedzones/${zoneId}/tags`, { method: "PUT", body: { tags } }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: tag update.
      await queryClient.invalidateQueries({ queryKey: keys.zone(zoneId) });
      await queryClient.invalidateQueries({ queryKey: keys.tags(zoneId) });
    },
  });
}
