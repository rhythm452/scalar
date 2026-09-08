import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

// Every new leaf added by the chrome-parity nav restructure (docs/UI-PARITY.md) shares
// this one dynamic route rather than a real page per feature -- none of these are
// implemented, so the destination only needs to be visually/navigationally correct
// (the same Coming Soon pattern Phase 6 established for Health checks/Profiles/etc.).
const TITLES: Record<string, string> = {
  cloudshell: "CloudShell",
  help: "Help",
  "global-resolvers": "Global resolvers",
  "shared-views": "Shared DNS views",
  vpcs: "VPCs",
  "inbound-endpoints": "Inbound endpoints",
  "outbound-endpoints": "Outbound endpoints",
  rules: "Rules",
  "query-logging": "Query logging",
  outposts: "Outposts",
  "domain-requests": "Requests",
  "cidr-collections": "CIDR collections",
  "policy-records": "Policy records",
};

export function generateStaticParams() {
  return Object.keys(TITLES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: TITLES[slug] ?? "Coming Soon" };
}

export default async function ComingSoonSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = TITLES[slug];
  if (!title) notFound();
  return <ComingSoonPageClient service={title} href={`/route53/comingsoon/${slug}`} />;
}
