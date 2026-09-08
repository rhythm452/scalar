import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

export const metadata: Metadata = { title: "Domains" };

export default function DomainsPage() {
  return <ComingSoonPageClient service="Domains" href="/route53/domains" />;
}
