"use client";

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { NavLink } from "@/components/shell/nav-link";

// UI-PARITY §2 "Mocked" screen inventory: same shell-consistent Coming Soon shape
// for Health checks, Traffic policies, Resolver, Profiles, and Domains (Phase 6).
export function ComingSoonPageClient({ service, href }: { service: string; href: string }) {
  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: service, href },
  ]);

  return (
    <ContentLayout header={<Header variant="h1">{service}</Header>}>
      <Container header={<Header variant="h2">Coming Soon</Header>}>
        <SpaceBetween size="m">
          <Box>
            {service} are mocked in this clone. Hosted zones and records are fully functional.
          </Box>
          <NavLink href="/route53/hostedzones" variant="normal">
            View hosted zones
          </NavLink>
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}
