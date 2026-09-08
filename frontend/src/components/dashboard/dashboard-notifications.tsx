"use client";

import { useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";

interface NotificationRow {
  resource: string;
  status: string;
  lastUpdate: string;
}

const COLUMN_DEFINITIONS: TableProps.ColumnDefinition<NotificationRow>[] = [
  { id: "resource", header: "Resource", cell: (item) => item.resource },
  { id: "status", header: "Status", cell: (item) => item.status },
  { id: "lastUpdate", header: "Last update", cell: (item) => item.lastUpdate },
];

// Fully mocked: no notification-producing feature exists in this clone, so this
// always renders the real table shell (columns, search, pagination) with zero rows
// rather than fabricating notification data (UI-PARITY dashboard-parity pass).
export function DashboardNotifications() {
  const [filteringText, setFilteringText] = useState("");

  return (
    <Table<NotificationRow>
      items={[]}
      columnDefinitions={COLUMN_DEFINITIONS}
      header={
        <Header
          variant="h2"
          actions={
            <Button iconName="refresh" ariaLabel="Refresh notifications" variant="icon" />
          }
        >
          Notifications
        </Header>
      }
      filter={
        <TextFilter
          filteringText={filteringText}
          filteringPlaceholder="Find notifications"
          filteringAriaLabel="Find notifications"
          onChange={({ detail }) => setFilteringText(detail.filteringText)}
        />
      }
      pagination={
        <Pagination
          currentPageIndex={1}
          pagesCount={1}
          ariaLabels={{ paginationLabel: "Notifications pagination" }}
        />
      }
      ariaLabels={{ tableLabel: "Notifications table" }}
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="s">
            <Box variant="strong">No notifications to display</Box>
          </SpaceBetween>
        </Box>
      }
    />
  );
}
