import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLogin } from "@/hooks/use-login";
import { isApiError } from "@/lib/error";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useLogin", () => {
  it("succeeds with valid demo credentials", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ username: "admin", password: "password123" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.user.username).toBe("admin");
  });

  it("surfaces the backend's exact error message on bad credentials", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ username: "admin", password: "wrong" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(isApiError(error) ? error.message : null).toBe("Invalid username or password.");
  });
});
