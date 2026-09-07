import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { SessionResponse } from "@/types/user";

export function useSession() {
  return useQuery({
    queryKey: keys.session(),
    queryFn: () => apiFetch<SessionResponse>("/auth/session"),
    staleTime: 60_000,
    // A 401 here means "not logged in", not a transient failure -- retrying can't
    // succeed and would just hammer the endpoint.
    retry: false,
  });
}
