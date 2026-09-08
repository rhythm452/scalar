import type { Metadata } from "next";
import { CreateRecordPageClient } from "@/components/records/create-record-page-client";

export const metadata: Metadata = { title: "Create record" };

export default async function CreateRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateRecordPageClient zoneId={id} />;
}
