"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Spinner from "@cloudscape-design/components/spinner";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { NavLink } from "@/components/shell/nav-link";
import { useHostedZone } from "@/hooks/use-hosted-zone";
import { isApiError } from "@/lib/error";
import { DeleteZoneModal } from "@/components/hosted-zones/delete-zone-modal";
import { ZoneDetailsTab } from "@/components/hosted-zones/zone-details-tab";
import { ZoneRecordsTab } from "@/components/hosted-zones/zone-records-tab";
import { ZoneTagsTab } from "@/components/hosted-zones/zone-tags-tab";

const TAB_IDS = ["records", "details", "tags"] as const;
type TabId = (typeof TAB_IDS)[number];

export function ZoneDetailPageClient({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, error } = useHostedZone(zoneId);

  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
    { text: data?.zone.name ?? zoneId, href: `/route53/hostedzones/${zoneId}` },
  ]);

  if (isLoading) {
    return (
      <ContentLayout>
        <Box textAlign="center" padding={{ top: "xxxl" }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (isError || !data) {
    return (
      <ContentLayout>
        <SpaceBetween size="m">
          <Alert type="error" header="Hosted zone not found">
            {isApiError(error) ? error.message : "This hosted zone could not be found."}
          </Alert>
          <NavLink href="/route53/hostedzones">Back to hosted zones</NavLink>
        </SpaceBetween>
      </ContentLayout>
    );
  }

  const { zone, tags } = data;
  const activeTabId = (TAB_IDS as readonly string[]).includes(searchParams.get("tab") ?? "")
    ? (searchParams.get("tab") as TabId)
    : "records";

  return (
    <ContentLayout
      header={
        <Header variant="h1" actions={<Button onClick={() => setDeleting(true)}>Delete</Button>}>
          {zone.name}
        </Header>
      }
    >
      <Tabs
        activeTabId={activeTabId}
        onChange={({ detail }) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("tab", detail.activeTabId);
          router.replace(`${pathname}?${params.toString()}`);
        }}
        tabs={[
          {
            id: "records",
            label: `Records (${zone.record_set_count})`,
            content: <ZoneRecordsTab zoneId={zone.id} />,
          },
          { id: "details", label: "Hosted zone details", content: <ZoneDetailsTab zone={zone} /> },
          { id: "tags", label: "Tags", content: <ZoneTagsTab zoneId={zone.id} tags={tags} /> },
        ]}
      />
      <DeleteZoneModal
        zoneId={zone.id}
        zoneName={zone.name}
        visible={deleting}
        onDismiss={() => setDeleting(false)}
      />
    </ContentLayout>
  );
}
