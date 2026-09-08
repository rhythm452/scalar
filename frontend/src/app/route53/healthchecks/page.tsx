import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

export const metadata: Metadata = { title: "Health checks" };

export default function HealthChecksPage() {
  return <ComingSoonPageClient service="Health checks" href="/route53/healthchecks" />;
}
