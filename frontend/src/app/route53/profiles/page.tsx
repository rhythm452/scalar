import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

export const metadata: Metadata = { title: "Profiles" };

export default function ProfilesPage() {
  return <ComingSoonPageClient service="Profiles" href="/route53/profiles" />;
}
