import type { Metadata } from "next";
import { HostedZonesPageClient } from "@/components/hosted-zones/hosted-zones-page-client";

export const metadata: Metadata = { title: "Hosted zones" };

export default function HostedZonesPage() {
  return <HostedZonesPageClient />;
}
