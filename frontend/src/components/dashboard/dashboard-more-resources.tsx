"use client";

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Icon from "@cloudscape-design/components/icon";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";

const RESOURCE_LINKS = [
  { text: "Documentation", href: "https://docs.aws.amazon.com/route53/" },
  { text: "API reference", href: "https://docs.aws.amazon.com/Route53/latest/APIReference/Welcome.html" },
  { text: "FAQs", href: "https://aws.amazon.com/route53/faqs/" },
  {
    text: "Forum - DNS and health checks",
    href: "https://repost.aws/tags/TAceSYwryvTxuK8Uw1UKOTVA",
  },
  {
    text: "Forum - Domain name registration",
    href: "https://repost.aws/tags/TALtFqNjU_SuChk8RZQgRknA/route-53-registrar",
  },
  {
    text: "Request a limit increase",
    href: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/DNSLimitations.html",
  },
];

// Real AWS URLs, opened in a new tab -- these are genuinely useful even in a demo
// (UI-PARITY dashboard-parity pass), unlike the other mocked sections on this page.
export function DashboardMoreResources() {
  return (
    <Container
      header={
        <Header variant="h2" info={<Icon name="external" size="small" />}>
          More resources
        </Header>
      }
    >
      <SpaceBetween size="s">
        {RESOURCE_LINKS.map((link) => (
          <div key={link.text}>
            <Link external href={link.href}>
              {link.text}
            </Link>
          </div>
        ))}
      </SpaceBetween>
    </Container>
  );
}
