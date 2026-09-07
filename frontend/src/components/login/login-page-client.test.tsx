import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LoginPageClient } from "@/components/login/login-page-client";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("LoginPageClient", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("shows the demo-credentials alert verbatim (docs/UI-PARITY.md §2, ADR-015)", () => {
    renderWithProviders(<LoginPageClient next="/route53" />);
    expect(screen.getByText("Demo credentials")).toBeInTheDocument();
    expect(screen.getByText("Username: admin / Password: password123")).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPageClient next="/route53" />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Username is required")).toBeInTheDocument();
    expect(await screen.findByText("Password is required")).toBeInTheDocument();
  });

  it("shows the backend error message on invalid credentials and does not navigate", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPageClient next="/route53" />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid username or password.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to the sanitized next path on successful login", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPageClient next="/route53/hostedzones" />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/route53/hostedzones"));
  });
});
