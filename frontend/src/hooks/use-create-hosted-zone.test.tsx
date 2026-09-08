import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCreateHostedZone } from "@/hooks/use-create-hosted-zone";
import { isApiError } from "@/lib/error";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCreateHostedZone", () => {
  it("creates a public zone", async () => {
    const { result } = renderHook(() => useCreateHostedZone(), { wrapper });
    result.current.mutate({ name: "new-zone.com", type: "public" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.zone.name).toBe("new-zone.com.");
  });

  it("surfaces HostedZoneAlreadyExists for a duplicate name", async () => {
    const { result } = renderHook(() => useCreateHostedZone(), { wrapper });
    result.current.mutate({ name: "empty.example.com", type: "public" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(isApiError(error) ? error.code : null).toBe("HostedZoneAlreadyExists");
  });
});
