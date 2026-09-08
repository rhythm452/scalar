import type { Metadata } from "next";
import { CreateZonePageClient } from "@/components/hosted-zones/create-zone-page-client";

export const metadata: Metadata = { title: "Create hosted zone" };

export default function CreateHostedZonePage() {
  return <CreateZonePageClient />;
}
