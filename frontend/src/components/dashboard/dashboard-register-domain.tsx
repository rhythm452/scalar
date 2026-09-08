"use client";

import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";

// Fully mocked -- no domain-registration feature exists in this clone's scope
// (UI-PARITY dashboard-parity pass). "Check" never calls a real API; it only reveals
// a static notice, so it's never presented as if it were functional.
export function DashboardRegisterDomain() {
  const [domainName, setDomainName] = useState("");
  const [checked, setChecked] = useState(false);

  return (
    <Container header={<Header variant="h2">Register domain</Header>}>
      <SpaceBetween size="l">
        <Box variant="p">
          Search for and register a new domain, or{" "}
          <Link
            external
            href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-transfer-to-route-53.html"
          >
            transfer your existing domains
          </Link>{" "}
          to Route 53.
        </Box>
        <SpaceBetween direction="horizontal" size="s" alignItems="end">
          <FormField
            label="Enter a domain name"
            constraintText="Valid characters: a-z, 0-9, and hyphens (-). A hyphen can't be the first or last character."
          >
            <Input
              value={domainName}
              onChange={({ detail }) => {
                setDomainName(detail.value);
                setChecked(false);
              }}
              placeholder="example.com"
              ariaLabel="Enter a domain name"
            />
          </FormField>
          <Button onClick={() => setChecked(true)} disabled={!domainName}>
            Check
          </Button>
        </SpaceBetween>
        {checked ? (
          <Alert type="info">Domain registration is not available in this demo.</Alert>
        ) : null}
      </SpaceBetween>
    </Container>
  );
}
