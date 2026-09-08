import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useUpdateHostedZone } from "@/hooks/use-update-hosted-zone";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useUpdateHostedZone", () => {
  it("updates the zone comment", async () => {
    const { result } = renderHook(() => useUpdateHostedZone("zone_empty"), { wrapper });
    result.current.mutate("New description");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.zone.comment).toBe("New description");
  });
});
