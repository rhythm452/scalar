import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications";

describe("DashboardNotifications", () => {
  it("always renders the empty state, since no notification-producing feature exists", () => {
    render(<DashboardNotifications />);
    expect(screen.getByText("No notifications to display")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Find notifications")).toBeInTheDocument();
  });
});
