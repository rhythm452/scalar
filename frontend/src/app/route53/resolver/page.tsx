import type { Metadata } from "next";
import { ComingSoonPageClient } from "@/components/mocked/coming-soon-page-client";

export const metadata: Metadata = { title: "Resolver" };

export default function ResolverPage() {
  return <ComingSoonPageClient service="Resolver" href="/route53/resolver" />;
}
