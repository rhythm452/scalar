import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickCreateRecordForm } from "@/components/records/quick-create-record-form";
import { FlashbarProvider } from "@/components/shell/flashbar-context";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashbarProvider>
        <QuickCreateRecordForm zoneId="zone_full" zoneName="full.example.com." onSwitchToWizard={vi.fn()} />
      </FlashbarProvider>
    </QueryClientProvider>,
  );
}

describe("QuickCreateRecordForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("creates an A record and navigates back to the records tab", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Record name"), "new-host");
    await user.clear(screen.getByLabelText("TTL (seconds)"));
    await user.type(screen.getByLabelText("TTL (seconds)"), "300");
    await user.type(screen.getByLabelText("Value"), "192.0.2.5");
    await user.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/route53/hostedzones/zone_full")),
    );
  });

  it("surfaces the R4 CNAME-coexistence error on the record name field", async () => {
    const user = userEvent.setup();
    renderForm();

    // rec_1 in the MSW fixture is an A record at full.example.com. -- creating
    // a CNAME at the same (apex) name must collide (docs/ROUTE53-DOMAIN-RULES.md R4).
    await user.click(screen.getByLabelText("Record type"));
    await user.click(await screen.findByText("CNAME"));
    await user.type(screen.getByLabelText("Value"), "target.example.com.");
    await user.click(screen.getByRole("button", { name: "Create record" }));

    expect(
      await screen.findByText(/is not permitted because a conflicting RRSet exists/),
    ).toBeInTheDocument();
    // The error must land on the record-name field, not only a top-level Alert.
    const nameField = screen.getByLabelText("Record name").closest('[class*="form-field"]') ?? document.body;
    expect(within(nameField as HTMLElement).queryByText(/conflicting RRSet/)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("adds and removes an extra record row", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getAllByText(/^Record \d$/)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add another record" }));
    expect(screen.getAllByText(/^Record \d$/)).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.getAllByText(/^Record \d$/)).toHaveLength(1);
  });
});
