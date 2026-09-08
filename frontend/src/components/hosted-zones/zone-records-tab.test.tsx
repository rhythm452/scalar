import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZoneRecordsTab } from "@/components/hosted-zones/zone-records-tab";
import { FlashbarProvider } from "@/components/shell/flashbar-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/route53/hostedzones/zone_full",
  useSearchParams: () => new URLSearchParams(),
}));

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashbarProvider>
        <ZoneRecordsTab zoneId="zone_full" />
      </FlashbarProvider>
    </QueryClientProvider>,
  );
}

describe("ZoneRecordsTab", () => {
  it("lists the seeded records including the system NS record", async () => {
    renderTab();
    expect(await screen.findByText("Records (3)")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.1")).toBeInTheDocument();
  });

  it("disables the delete action for a system record (R2)", async () => {
    renderTab();
    await screen.findByText("Records (3)");
    // rec_ns is the fixture's system NS record; its row's checkbox must be
    // disabled and its Delete action must not be an actionable link.
    const rows = screen.getAllByRole("row");
    const nsRow = rows.find((row) => row.textContent?.includes("NS"));
    expect(nsRow).toBeTruthy();
    const checkbox = nsRow!.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeDisabled();
  });

  it("bulk-deletes selected non-system records via the Actions dropdown", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Records (3)");

    const rows = screen.getAllByRole("row");
    const cnameRow = rows.find((row) => row.textContent?.includes("CNAME"));
    const checkbox = cnameRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText(/permanently delete the following/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Delete" }).slice(-1)[0]!);
    await waitFor(() => expect(screen.getByText("Records (2)")).toBeInTheDocument());
  });
});
