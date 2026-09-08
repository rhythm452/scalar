"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useHostedZones } from "@/hooks/use-hosted-zones";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { formatRelativeDate } from "@/lib/format-date";
import type { HostedZoneListItem, HostedZoneListParams, HostedZoneType } from "@/types/hosted-zone";
import { NavLink } from "@/components/shell/nav-link";
import { ZoneTypeBadge } from "@/components/hosted-zones/zone-type-badge";

const TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

const CONTENT_DISPLAY_DEFAULT = [
  { id: "name", visible: true },
  { id: "type", visible: true },
  { id: "comment", visible: true },
  { id: "records", visible: true },
  { id: "created", visible: true },
];

const COLUMN_DEFINITIONS: TableProps.ColumnDefinition<HostedZoneListItem>[] = [
  {
    id: "name",
    header: "Domain name",
    cell: (item) => <NavLink href={`/route53/hostedzones/${item.id}`}>{item.name}</NavLink>,
    sortingField: "name",
    width: 300,
    isRowHeader: true,
  },
  {
    id: "type",
    header: "Type",
    cell: (item) => <ZoneTypeBadge type={item.type} />,
    width: 120,
  },
  {
    id: "comment",
    header: "Description",
    cell: (item) => item.comment || <Box color="text-body-secondary">-</Box>,
    width: 280,
  },
  {
    id: "records",
    header: "Records",
    cell: (item) => item.record_set_count,
    sortingField: "record_set_count",
    width: 100,
  },
  {
    id: "created",
    header: "Created",
    cell: (item) => formatRelativeDate(item.created_at),
    sortingField: "created_at",
    width: 200,
  },
];

export function HostedZonesTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput);
  const typeFilter = (searchParams.get("type") as HostedZoneType | null) ?? "";
  const sortBy = (searchParams.get("sort_by") as HostedZoneListParams["sort_by"]) ?? "name";
  const sortOrder = (searchParams.get("sort_order") as HostedZoneListParams["sort_order"]) ?? "asc";

  const pagination = useCursorPagination();
  const [preferences, setPreferences] = useTablePreferences("r53-hostedzones-table", {
    pageSize: 20,
    wrapLines: false,
    contentDisplay: CONTENT_DISPLAY_DEFAULT,
  });

  // docs/ARCHITECTURE.md §3: filter changes write to the URL (debounced) via router.replace.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
    pagination.reset();
  };

  const queryParams: HostedZoneListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      type: (typeFilter || undefined) as HostedZoneType | undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page_size: preferences.pageSize,
      next_token: pagination.currentToken,
    }),
    [debouncedSearch, typeFilter, sortBy, sortOrder, preferences.pageSize, pagination.currentToken],
  );

  const { data, isLoading, isFetching } = useHostedZones(queryParams);

  const sortingColumn =
    COLUMN_DEFINITIONS.find((column) => column.sortingField === sortBy) ?? COLUMN_DEFINITIONS[0];
  const visibleContentIds = preferences.contentDisplay.filter((c) => c.visible).map((c) => c.id);

  return (
    <Table
      items={data?.items ?? []}
      columnDefinitions={COLUMN_DEFINITIONS}
      visibleColumns={visibleContentIds}
      wrapLines={preferences.wrapLines}
      stickyHeader
      loading={isLoading || isFetching}
      loadingText="Loading hosted zones"
      ariaLabels={{ tableLabel: "Hosted zones table" }}
      sortingColumn={sortingColumn}
      sortingDescending={sortOrder === "desc"}
      onSortingChange={({ detail }) => {
        updateParams({
          sort_by: detail.sortingColumn.sortingField ?? "name",
          sort_order: detail.isDescending ? "desc" : "asc",
        });
      }}
      filter={
        <SpaceBetween direction="horizontal" size="s">
          <TextFilter
            filteringText={searchInput}
            filteringPlaceholder="Filter hosted zones"
            filteringAriaLabel="Filter hosted zones"
            onChange={({ detail }) => setSearchInput(detail.filteringText)}
            countText={
              data ? `${data.items.length} match${data.items.length === 1 ? "" : "es"}` : undefined
            }
          />
          {/* UI-PARITY §1 calls for a PropertyFilter here; a single equality filter on
              "type" doesn't need PropertyFilter's token/operator machinery, so we use a
              plain Select instead (documented as a deviation in docs/UI-PARITY.md §7). */}
          <Select
            selectedOption={
              TYPE_OPTIONS.find((option) => option.value === typeFilter) ?? TYPE_OPTIONS[0] ?? null
            }
            onChange={({ detail }) => updateParams({ type: detail.selectedOption.value ?? "" })}
            options={TYPE_OPTIONS}
            ariaLabel="Filter by type"
          />
        </SpaceBetween>
      }
      pagination={
        <Pagination
          currentPageIndex={pagination.pageIndex}
          pagesCount={pagination.pageIndex}
          openEnd={Boolean(data?.next_token)}
          ariaLabels={{ paginationLabel: "Hosted zones pagination" }}
          onPreviousPageClick={() => pagination.goToPreviousPage()}
          onNextPageClick={() => {
            if (data?.next_token) pagination.goToNextPage(data.next_token);
          }}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={{
            pageSize: preferences.pageSize,
            wrapLines: preferences.wrapLines,
            contentDisplay: preferences.contentDisplay,
          }}
          pageSizePreference={{
            title: "Page size",
            options: [
              { value: 10, label: "10 hosted zones" },
              { value: 20, label: "20 hosted zones" },
              { value: 50, label: "50 hosted zones" },
            ],
          }}
          wrapLinesPreference={{
            label: "Wrap lines",
            description: "Wrap long text and show all information.",
          }}
          contentDisplayPreference={{
            title: "Column preferences",
            options: COLUMN_DEFINITIONS.map((column) => ({
              id: column.id as string,
              label: String(column.header),
              alwaysVisible: column.id === "name",
            })),
          }}
          onConfirm={({ detail }) => {
            setPreferences({
              pageSize: detail.pageSize ?? preferences.pageSize,
              wrapLines: detail.wrapLines ?? preferences.wrapLines,
              contentDisplay: detail.contentDisplay ?? preferences.contentDisplay,
            });
            pagination.reset();
          }}
        />
      }
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <Box variant="strong">No hosted zones</Box>
            <Box variant="p" color="inherit">
              You don&apos;t have any hosted zones.
            </Box>
            <NavLink href="/route53/hostedzones/create" variant="normal">
              Create hosted zone
            </NavLink>
          </SpaceBetween>
        </Box>
      }
    />
  );
}
