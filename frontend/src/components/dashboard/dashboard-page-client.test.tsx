import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { BreadcrumbsProvider } from "@/components/shell/breadcrumbs-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BreadcrumbsProvider>
        <DashboardPageClient />
      </BreadcrumbsProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardPageClient", () => {
  it("renders the header, info link, and the real console's action card row", async () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Route 53 Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(await screen.findByText("DNS management")).toBeInTheDocument();
  });

  it("renders the register-domain and notifications sections", async () => {
    renderDashboard();
    expect(await screen.findByText("Register domain")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders the more-resources and service-health sections", async () => {
    renderDashboard();
    expect(await screen.findByText("More resources")).toBeInTheDocument();
    expect(screen.getByText("Service health")).toBeInTheDocument();
  });
});
