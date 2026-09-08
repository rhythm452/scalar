"use client";

import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { NavLink } from "@/components/shell/nav-link";
import type { DashboardSummary } from "@/types/dashboard";

// Real console top row: three bordered cards (DNS management / Availability
// monitoring / Traffic management) plus a fourth "Domain registration" column with
// no card border -- real AWS shows an error state there because domain registration
// isn't available in every Region. This clone has no domain-registration feature at
// all, so that column is a static label rather than a functional error state
// (UI-PARITY dashboard-parity pass).
export function DashboardActionCards({
  summary,
  isLoading,
}: {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}) {
  const zoneCount = summary?.zones ?? 0;
  const zoneCountText = isLoading ? (
    <Spinner size="normal" />
  ) : (
    ` You have ${zoneCount} hosted zone${zoneCount === 1 ? "" : "s"}.`
  );

  return (
    <ColumnLayout columns={4}>
      <Container header={<Header variant="h2">DNS management</Header>}>
        <SpaceBetween size="m">
          <Box variant="p">
            A hosted zone tells Route 53 how to respond to DNS queries for a domain such as
            example.com.
            {zoneCountText}
          </Box>
          <NavLink href="/route53/hostedzones/create" variant="normal">
            Create hosted zone
          </NavLink>
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h2">Availability monitoring</Header>}>
        <SpaceBetween size="m">
          <Box variant="p">
            Health checks monitor your applications and web resources, and direct DNS queries to
            healthy resources.
          </Box>
          <NavLink href="/route53/healthchecks" variant="normal">
            Create health check
          </NavLink>
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h2">Traffic management</Header>}>
        <SpaceBetween size="m">
          <Box variant="p">
            A visual tool that lets you easily create policies for multiple endpoints in complex
            configurations.
          </Box>
          <NavLink href="/route53/trafficpolicies" variant="normal">
            Create policy
          </NavLink>
        </SpaceBetween>
      </Container>
      <Box padding={{ top: "l", horizontal: "s" }}>
        <SpaceBetween size="m">
          <Box variant="h2" fontWeight="bold">
            Domain registration
          </Box>
          <Box variant="p" color="text-body-secondary">
            Domain registration is not available in this demo.
          </Box>
          <Link external href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html">
            Domains
          </Link>
        </SpaceBetween>
      </Box>
    </ColumnLayout>
  );
}
