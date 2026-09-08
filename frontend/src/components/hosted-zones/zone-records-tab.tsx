"use client";

import { useMemo, useState } from "react";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRecords } from "@/hooks/use-records";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { NavLink } from "@/components/shell/nav-link";
import type { RecordListParams } from "@/types/record";

// Phase 4 scope: read-only listing (GET /rrsets only). Create/edit/delete, bulk
// selection, and the Import/Export ButtonDropdown are Phase 5/7 additions on top
// of this same table shell and query key (docs/ROADMAP.md Phase 5/7).
export function ZoneRecordsTab({ zoneId }: { zoneId: string }) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput);
  const pagination = useCursorPagination();

  const params: RecordListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      page_size: 50,
      next_token: pagination.currentToken,
    }),
    [debouncedSearch, pagination.currentToken],
  );

  const { data, isLoading, isFetching } = useRecords(zoneId, params);

  return (
    <Table
      items={data?.items ?? []}
      trackBy="id"
      stickyHeader
      loading={isLoading || isFetching}
      loadingText="Loading records"
      ariaLabels={{ tableLabel: "Records table" }}
      columnDefinitions={[
        {
          id: "name",
          header: "Record name",
          cell: (record) => record.name,
          isRowHeader: true,
          width: 260,
        },
        { id: "type", header: "Record type", cell: (record) => record.type, width: 100 },
        { id: "ttl", header: "TTL (seconds)", cell: (record) => record.ttl ?? "-", width: 120 },
        {
          id: "routing_policy",
          header: "Routing policy",
          cell: (record) => record.routing_policy,
          width: 140,
        },
        { id: "values", header: "Value", cell: (record) => record.values.join(", ") || "-" },
      ]}
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <NavLink href={`/route53/hostedzones/${zoneId}/records/create`} variant="primary">
                Create record
              </NavLink>
            </SpaceBetween>
          }
        >
          Records ({data?.items.length ?? 0})
        </Header>
      }
      filter={
        <TextFilter
          filteringText={searchInput}
          filteringPlaceholder="Filter records by property or value"
          filteringAriaLabel="Filter records by property or value"
          onChange={({ detail }) => setSearchInput(detail.filteringText)}
        />
      }
      pagination={
        <Pagination
          currentPageIndex={pagination.pageIndex}
          pagesCount={pagination.pageIndex}
          openEnd={Boolean(data?.next_token)}
          ariaLabels={{ paginationLabel: "Records pagination" }}
          onPreviousPageClick={() => pagination.goToPreviousPage()}
          onNextPageClick={() => {
            if (data?.next_token) pagination.goToNextPage(data.next_token);
          }}
        />
      }
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <Box variant="strong">No records</Box>
            <NavLink href={`/route53/hostedzones/${zoneId}/records/create`} variant="normal">
              Create record
            </NavLink>
          </SpaceBetween>
        </Box>
      }
    />
  );
}
