import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import type { LoginFormValues } from "@/types/auth-forms";
import type { LoginResponse } from "@/types/user";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LoginFormValues) =>
      apiFetch<LoginResponse>("/auth/login", { method: "POST", body: values }),
    onSuccess: async () => {
      // docs/ARCHITECTURE.md §5 cache-invalidation table: login invalidates session + summary.
      await queryClient.invalidateQueries({ queryKey: keys.session() });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
    },
  });
}
