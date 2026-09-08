import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DeleteZoneModal } from "@/components/hosted-zones/delete-zone-modal";
import { FlashbarProvider } from "@/components/shell/flashbar-context";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashbarProvider>{ui}</FlashbarProvider>
    </QueryClientProvider>,
  );
}

describe("DeleteZoneModal", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("deletes an empty zone and navigates back to the list", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteZoneModal
        zoneId="zone_empty"
        zoneName="empty.example.com."
        visible
        onDismiss={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/route53/hostedzones"));
  });

  it("surfaces R3's HostedZoneNotEmpty message and keeps the modal open", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteZoneModal
        zoneId="zone_full"
        zoneName="full.example.com."
        visible
        onDismiss={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(
        "Hosted Zone is not empty. Delete all non-default record sets before deleting the hosted zone.",
      ),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
