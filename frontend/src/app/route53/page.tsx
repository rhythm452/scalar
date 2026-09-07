import type { Metadata } from "next";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";

export const metadata: Metadata = { title: "Route 53 Dashboard" };

export default function Route53DashboardPage() {
  return <DashboardPageClient />;
}
