import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { DashboardSummary } from "@/types/dashboard";

export function useSummary() {
  return useQuery({
    queryKey: keys.summary(),
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
    staleTime: 60_000,
  });
}
