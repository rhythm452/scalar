import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecordEditForm } from "@/components/records/record-edit-form";
import { FlashbarProvider } from "@/components/shell/flashbar-context";
import type { RecordItem } from "@/types/record";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const RECORD: RecordItem = {
  id: "rec_1",
  name: "full.example.com.",
  type: "A",
  ttl: 300,
  routing_policy: "simple",
  set_identifier: null,
  weight: null,
  region: null,
  failover: null,
  geo_continent: null,
  geo_country: null,
  geo_subdivision: null,
  values: ["192.0.2.1"],
  is_alias: false,
  alias_target: null,
  alias_hosted_zone_id: null,
  alias_evaluate_target_health: null,
  is_system: false,
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashbarProvider>
        <RecordEditForm zoneId="zone_full" zoneName="full.example.com." record={RECORD} />
      </FlashbarProvider>
    </QueryClientProvider>,
  );
}

describe("RecordEditForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("prefills the current TTL and value, and saves an update", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByDisplayValue("300")).toBeInTheDocument();
    expect(screen.getByDisplayValue("192.0.2.1")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("TTL (seconds)"));
    await user.type(screen.getByLabelText("TTL (seconds)"), "600");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/route53/hostedzones/zone_full")),
    );
  });

  it("prompts to discard unsaved changes on Cancel", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("TTL (seconds)"));
    await user.type(screen.getByLabelText("TTL (seconds)"), "900");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/route53/hostedzones/zone_full"));
  });

  it("cancels immediately with no unsaved changes", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/route53/hostedzones/zone_full"));
  });
});
