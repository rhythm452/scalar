import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useHostedZones } from "@/hooks/use-hosted-zones";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useHostedZones", () => {
  it("lists the seeded zones", async () => {
    const { result } = renderHook(() => useHostedZones({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
  });

  it("filters by type via the query params", async () => {
    const { result } = renderHook(() => useHostedZones({ type: "public" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.every((zone) => zone.type === "public")).toBe(true);
  });
});
