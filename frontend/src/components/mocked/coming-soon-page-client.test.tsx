import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";
import { BreadcrumbsProvider } from "@/components/shell/breadcrumbs-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ComingSoonPageClient", () => {
  it("renders the shell-consistent Coming Soon copy for the given service (docs/UI-PARITY.md §2)", () => {
    render(
      <BreadcrumbsProvider>
        <ComingSoonPageClient service="Health checks" href="/route53/healthchecks" />
      </BreadcrumbsProvider>,
    );
    expect(screen.getByRole("heading", { name: "Health checks" })).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Health checks are mocked in this clone. Hosted zones and records are fully functional.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View hosted zones" })).toBeInTheDocument();
  });
});
