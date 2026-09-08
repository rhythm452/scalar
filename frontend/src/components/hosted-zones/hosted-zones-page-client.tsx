"use client";

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { NavLink } from "@/components/shell/nav-link";
import { HostedZonesTable } from "@/components/hosted-zones/hosted-zones-table";

export function HostedZonesPageClient() {
  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
  ]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <NavLink href="/route53/hostedzones/create" variant="primary">
              Create hosted zone
            </NavLink>
          }
        >
          Hosted zones
        </Header>
      }
    >
      <HostedZonesTable />
    </ContentLayout>
  );
}
