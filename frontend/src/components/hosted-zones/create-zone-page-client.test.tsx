import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CreateZonePageClient } from "@/components/hosted-zones/create-zone-page-client";
import { BreadcrumbsProvider } from "@/components/shell/breadcrumbs-context";
import { FlashbarProvider } from "@/components/shell/flashbar-context";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BreadcrumbsProvider>
        <FlashbarProvider>{ui}</FlashbarProvider>
      </BreadcrumbsProvider>
    </QueryClientProvider>,
  );
}

describe("CreateZonePageClient", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("requires a domain name before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateZonePageClient />);
    await user.click(screen.getByRole("button", { name: "Create hosted zone" }));
    expect(await screen.findByText("Domain name is required")).toBeInTheDocument();
  });

  it("reveals VPC fields for a private zone and requires them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateZonePageClient />);
    await user.type(screen.getByLabelText("Domain name"), "private.example.com");
    await user.click(screen.getByText("Private hosted zone"));
    expect(screen.getByText("VPC ID")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create hosted zone" }));
    expect(await screen.findByText("VPC ID is required")).toBeInTheDocument();
    expect(await screen.findByText("VPC region is required")).toBeInTheDocument();
  });

  it("navigates to the new zone's detail page on success", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateZonePageClient />);
    await user.type(screen.getByLabelText("Domain name"), "new-zone.com");
    await user.click(screen.getByRole("button", { name: "Create hosted zone" }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/route53/hostedzones/")),
    );
  });

  it("surfaces the backend's duplicate-name error on the name field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateZonePageClient />);
    await user.type(screen.getByLabelText("Domain name"), "empty.example.com");
    await user.click(screen.getByRole("button", { name: "Create hosted zone" }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
