"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { NavLink } from "@/components/shell/nav-link";
import { HostedZonesTable } from "@/components/hosted-zones/hosted-zones-table";
import { DeleteZoneModal } from "@/components/hosted-zones/delete-zone-modal";
import type { HostedZoneListItem } from "@/types/hosted-zone";

export function HostedZonesPageClient() {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<HostedZoneListItem[]>([]);
  const [count, setCount] = useState(0);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const selected = selectedItems[0];

  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
  ]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                disabled={!selected}
                onClick={() => selected && router.push(`/route53/hostedzones/${selected.id}`)}
              >
                View details
              </Button>
              <Button
                disabled={!selected}
                onClick={() =>
                  selected && router.push(`/route53/hostedzones/${selected.id}?tab=details`)
                }
              >
                Edit
              </Button>
              <Button disabled={!selected} onClick={() => setDeleteVisible(true)}>
                Delete
              </Button>
              <span className="r53-primary-cta">
                <NavLink href="/route53/hostedzones/create" variant="primary">
                  Create hosted zone
                </NavLink>
              </span>
            </SpaceBetween>
          }
        >
          {`Hosted zones (${count})`}
        </Header>
      }
    >
      <HostedZonesTable
        selectedItems={selectedItems}
        onSelectionChangeAction={setSelectedItems}
        onCountChangeAction={setCount}
      />
      {selected ? (
        <DeleteZoneModal
          zoneId={selected.id}
          zoneName={selected.name}
          visible={deleteVisible}
          onDismiss={() => setDeleteVisible(false)}
        />
      ) : null}
    </ContentLayout>
  );
}
