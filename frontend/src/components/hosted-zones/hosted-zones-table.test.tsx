import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { HostedZonesTable } from "@/components/hosted-zones/hosted-zones-table";
import { server } from "../../../tests/msw/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/route53/hostedzones",
  useSearchParams: () => new URLSearchParams(),
}));

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HostedZonesTable selectedItems={[]} onSelectionChangeAction={() => {}} onCountChangeAction={() => {}} />
    </QueryClientProvider>,
  );
}

describe("HostedZonesTable", () => {
  it("shows the seeded zones with their domain names", async () => {
    renderTable();
    expect(await screen.findByText("empty.example.com.")).toBeInTheDocument();
    expect(await screen.findByText("full.example.com.")).toBeInTheDocument();
  });

  it("shows the exact empty-state copy when there are no zones (docs/UI-PARITY.md §2)", async () => {
    server.use(
      http.get("/api/v1/hostedzones", () => HttpResponse.json({ items: [], next_token: null })),
    );
    renderTable();
    expect(await screen.findByText("No hosted zones")).toBeInTheDocument();
    expect(screen.getByText("There are no hosted zones created for this account.")).toBeInTheDocument();
  });
});
