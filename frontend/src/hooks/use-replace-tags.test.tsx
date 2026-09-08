import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReplaceTags } from "@/hooks/use-replace-tags";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useReplaceTags", () => {
  it("replaces the tag set for a zone", async () => {
    const { result } = renderHook(() => useReplaceTags("zone_empty"), { wrapper });
    result.current.mutate([{ key: "env", value: "prod" }]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.tags).toEqual([{ key: "env", value: "prod" }]);
  });
});
