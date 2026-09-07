import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";

describe("DashboardCards", () => {
  it("does not show counts while loading", () => {
    render(<DashboardCards summary={undefined} isLoading />);
    expect(screen.queryByText("Hosted zones (0)")).not.toBeInTheDocument();
  });

  it("shows the exact card copy once loaded (docs/UI-PARITY.md §2)", () => {
    render(
      <DashboardCards
        summary={{ zones: 3, records: 42, health_checks: 0, traffic_policies: 0 }}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Hosted zones (3)")).toBeInTheDocument();
    expect(screen.getByText("Records (42)")).toBeInTheDocument();
    expect(screen.getByText("Health checks (0)")).toBeInTheDocument();
    expect(screen.getByText("Traffic policies (0)")).toBeInTheDocument();
  });
});
