import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

export const metadata: Metadata = { title: "Traffic policies" };

export default function TrafficPoliciesPage() {
  return <ComingSoonPageClient service="Traffic policies" href="/route53/trafficpolicies" />;
}
