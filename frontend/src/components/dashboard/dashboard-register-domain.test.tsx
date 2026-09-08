import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardRegisterDomain } from "@/components/dashboard/dashboard-register-domain";

describe("DashboardRegisterDomain", () => {
  it("shows a static non-functional notice after Check, never a real lookup result", async () => {
    render(<DashboardRegisterDomain />);
    const input = screen.getByLabelText("Enter a domain name");
    await userEvent.type(input, "example.com");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Domain registration is not available in this demo.")).toBeInTheDocument();
  });
});
