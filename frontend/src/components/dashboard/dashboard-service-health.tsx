"use client";

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";

export function DashboardServiceHealth() {
  return (
    <Container header={<Header variant="h2">Service health</Header>}>
      <Box variant="p">
        Check the current status of AWS services in each Region on the{" "}
        <Link external href="https://health.aws.amazon.com/health/status">
          AWS Service Health Dashboard
        </Link>
        .
      </Box>
    </Container>
  );
}
