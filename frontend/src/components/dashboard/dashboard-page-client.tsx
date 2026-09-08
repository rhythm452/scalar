"use client";

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useSummary } from "@/hooks/use-summary";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { DashboardActionCards } from "@/components/dashboard/dashboard-action-cards";

// The real console's "Info" link opens a HelpPanel in AppLayout's tools slot, but
// this app's shell renders `toolsHide` everywhere (no HelpPanel exists anywhere in
// the app) and app-shell.tsx is out of scope for this pass (chrome is frozen).
// Rather than fabricate a help panel just for this page, "Info" points at the real
// AWS Route 53 console user guide in a new tab -- a documented, honest deviation
// (UI-PARITY dashboard-parity pass) rather than a fake toggle that opens nothing.
export function DashboardPageClient() {
  useSetBreadcrumbs([{ text: "Route 53", href: "/route53" }]);
  const { data: summary, isLoading } = useSummary();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={
            <Link
              variant="info"
              external
              href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html"
            >
              Info
            </Link>
          }
        >
          Route 53 Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        <DashboardActionCards summary={summary} isLoading={isLoading} />
      </SpaceBetween>
    </ContentLayout>
  );
}
