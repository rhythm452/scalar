import type { Metadata } from "next";
import { ZoneDetailPageClient } from "@/components/hosted-zones/zone-detail-page-client";

export const metadata: Metadata = { title: "Hosted zone details" };

export default async function HostedZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ZoneDetailPageClient zoneId={id} />;
}
