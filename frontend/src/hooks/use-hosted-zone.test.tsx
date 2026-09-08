import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useHostedZone } from "@/hooks/use-hosted-zone";
import { isApiError } from "@/lib/error";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useHostedZone", () => {
  it("returns the zone and its tags", async () => {
    const { result } = renderHook(() => useHostedZone("zone_empty"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.zone.name).toBe("empty.example.com.");
    expect(result.current.data?.tags).toEqual([]);
  });

  it("surfaces NoSuchHostedZone for an unknown id", async () => {
    const { result } = renderHook(() => useHostedZone("zone_missing"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(isApiError(error) ? error.code : null).toBe("NoSuchHostedZone");
  });
});
