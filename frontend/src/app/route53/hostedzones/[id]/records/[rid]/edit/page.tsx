import type { Metadata } from "next";
import { EditRecordPageClient } from "@/components/records/edit-record-page-client";

export const metadata: Metadata = { title: "Edit record" };

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id, rid } = await params;
  return <EditRecordPageClient zoneId={id} recordId={rid} />;
}
