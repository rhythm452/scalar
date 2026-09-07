"use client";

import { useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useSummary } from "@/hooks/use-summary";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";

// The Phase-4 routes these actions link to don't exist yet -- they render and link
// there per docs/UI-PARITY.md §2, 404ing via app/not-found.tsx until Phase 4 lands.
export function DashboardPageClient() {
  const router = useRouter();
  useSetBreadcrumbs([{ text: "Route 53", href: "/route53" }]);
  const { data: summary, isLoading } = useSummary();

  const navigate = (href: string) => (event: { preventDefault: () => void }) => {
    event.preventDefault();
    router.push(href);
  };

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button href="/route53/hostedzones" onFollow={navigate("/route53/hostedzones")}>
                View hosted zones
              </Button>
              <Button
                variant="primary"
                href="/route53/hostedzones/create"
                onFollow={navigate("/route53/hostedzones/create")}
              >
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
        >
          Route 53 Dashboard
        </Header>
      }
    >
      <DashboardCards summary={summary} isLoading={isLoading} />
    </ContentLayout>
  );
}
