import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDeleteHostedZone } from "@/hooks/use-delete-hosted-zone";
import { isApiError } from "@/lib/error";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useDeleteHostedZone", () => {
  it("deletes an empty zone", async () => {
    const { result } = renderHook(() => useDeleteHostedZone("zone_empty"), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("surfaces R3's exact HostedZoneNotEmpty message for a zone with records", async () => {
    const { result } = renderHook(() => useDeleteHostedZone("zone_full"), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(isApiError(error) ? error.message : null).toBe(
      "Hosted Zone is not empty. Delete all non-default record sets before deleting the hosted zone.",
    );
  });
});
