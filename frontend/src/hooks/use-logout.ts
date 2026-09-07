import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { keys } from "@/lib/keys";
import { LOGIN_PATH } from "@/lib/constants";
import type { LogoutResponse } from "@/types/user";

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => apiFetch<LogoutResponse>("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.session() });
      await queryClient.invalidateQueries({ queryKey: keys.summary() });
      router.push(LOGIN_PATH);
    },
  });
}
