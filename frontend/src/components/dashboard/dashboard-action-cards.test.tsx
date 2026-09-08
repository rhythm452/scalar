import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardActionCards } from "@/components/dashboard/dashboard-action-cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("DashboardActionCards", () => {
  it("renders the three real console card headings and their CTAs", () => {
    render(<DashboardActionCards summary={{ zones: 14, records: 3, health_checks: 0, traffic_policies: 0 }} isLoading={false} />);
    expect(screen.getByText("DNS management")).toBeInTheDocument();
    expect(screen.getByText("Availability monitoring")).toBeInTheDocument();
    expect(screen.getByText("Traffic management")).toBeInTheDocument();
    expect(screen.getByText("Domain registration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create hosted zone" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create health check" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create policy" })).toBeInTheDocument();
  });

  it("folds the real zone count from the summary into the DNS management description", () => {
    render(<DashboardActionCards summary={{ zones: 14, records: 3, health_checks: 0, traffic_policies: 0 }} isLoading={false} />);
    expect(screen.getByText(/You have 14 hosted zones\./)).toBeInTheDocument();
  });
});
