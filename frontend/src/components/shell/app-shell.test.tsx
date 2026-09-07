import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { AppShell } from "@/components/shell/app-shell";
import { server } from "../../../tests/msw/server";
import { VALID_USER } from "../../../tests/msw/handlers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/route53",
}));

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <div>page content</div>
      </AppShell>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("renders every side navigation section and the session's identity", async () => {
    server.use(
      http.get("/api/v1/auth/session", () => HttpResponse.json({ user: VALID_USER }, { status: 200 })),
    );
    renderShell();

    for (const label of [
      "Hosted zones",
      "Health checks",
      "Traffic policies",
      "Resolver",
      "Profiles",
      "Domains",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    // TopNavigation renders a hidden duplicate for responsive width measurement, so
    // more than one match is expected -- assert presence, not uniqueness.
    await waitFor(() => expect(screen.getAllByText("Admin User").length).toBeGreaterThan(0));
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
