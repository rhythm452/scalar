"use client";

import { useMemo } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { useSetSplitPanel } from "@/components/shell/split-panel-context";
import { useHostedZone } from "@/hooks/use-hosted-zone";
import { useRecords } from "@/hooks/use-records";
import { isApiError } from "@/lib/error";
import { ZoneDetailPageClient } from "@/components/hosted-zones/zone-detail-page-client";
import { RecordEditForm } from "@/components/records/record-edit-form";

// UI-PARITY §2 /route53/hostedzones/{id}/records/{rid}/edit: "record Table
// behind a SplitPanel drawer" -- this renders the same zone-detail page (records
// tab, so the table is visible) and layers the edit form into the shared
// AppLayout SplitPanel slot via context (Part D).
//
// There is no single-record GET endpoint (docs/API.md §4 lists list/create/
// update/delete/batch only), so the record being edited is located in the
// already-paginated list rather than fetched directly -- a real, if minor,
// API gap for zones with more records than one page (see Phase 5 report §9).
export function EditRecordPageClient({ zoneId, recordId }: { zoneId: string; recordId: string }) {
  const zoneQuery = useHostedZone(zoneId);
  const recordsQuery = useRecords(zoneId, { page_size: 100 });

  const zoneName = zoneQuery.data?.zone.name;
  const record = recordsQuery.data?.items.find((item) => item.id === recordId);

  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
    { text: zoneName ?? zoneId, href: `/route53/hostedzones/${zoneId}` },
    { text: record?.name ?? recordId, href: `/route53/hostedzones/${zoneId}/records/${recordId}/edit` },
    { text: "Edit", href: `/route53/hostedzones/${zoneId}/records/${recordId}/edit` },
  ]);

  const panel = useMemo(() => {
    if (!record || !zoneName) return null;
    return {
      header: `Edit record: ${record.name}`,
      content: <RecordEditForm zoneId={zoneId} zoneName={zoneName} record={record} />,
    };
    // `record` is a fresh object per query refetch; keying on id + updated_at
    // keeps the panel's identity stable across re-renders that don't change data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, zoneName, record?.id, record?.updated_at]);
  useSetSplitPanel(panel);

  const isLoading = zoneQuery.isLoading || recordsQuery.isLoading;
  const isError = zoneQuery.isError || recordsQuery.isError;

  if (!isLoading && !isError && !record) {
    return (
      <Box padding="l">
        <Alert type="error" header="Record not found">
          {`This record could not be found in ${zoneName ?? "this zone"}.`}
        </Alert>
      </Box>
    );
  }

  if (isError) {
    const error = zoneQuery.error ?? recordsQuery.error;
    return (
      <Box padding="l">
        <Alert type="error" header="Couldn't load this record">
          {isApiError(error) ? error.message : "Something went wrong."}
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box textAlign="center" padding={{ top: "xxxl" }}>
        <Spinner size="large" />
      </Box>
    );
  }

  // Rendered once the split panel above already carries the edit form;
  // this is the records table the drawer sits beside.
  return <ZoneDetailPageClient zoneId={zoneId} />;
}
