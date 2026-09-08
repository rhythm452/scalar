"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import Popover from "@cloudscape-design/components/popover";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRecords } from "@/hooks/use-records";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { NavLink } from "@/components/shell/nav-link";
import { DeleteRecordModal } from "@/components/records/delete-record-modal";
import { BulkDeleteRecordsModal } from "@/components/records/bulk-delete-records-modal";
import { RECORD_TYPES, ROUTING_POLICIES, ROUTING_POLICY_LABELS } from "@/types/record-forms";
import type { RecordItem, RecordListParams } from "@/types/record";

const TYPE_OPTIONS = [
  { label: "All types", value: "" },
  ...RECORD_TYPES.map((type) => ({ label: type, value: type })),
];

const POLICY_OPTIONS = [
  { label: "All routing policies", value: "" },
  ...ROUTING_POLICIES.map((policy) => ({ label: ROUTING_POLICY_LABELS[policy], value: policy })),
];

const CONTENT_DISPLAY_DEFAULT = [
  { id: "name", visible: true },
  { id: "type", visible: true },
  { id: "routing_policy", visible: true },
  { id: "differentiator", visible: true },
  { id: "alias", visible: true },
  { id: "values", visible: true },
  { id: "ttl", visible: true },
  { id: "health_check_id", visible: false },
  { id: "evaluate_target_health", visible: false },
  { id: "id", visible: false },
  { id: "actions", visible: true },
];

function differentiatorFor(record: RecordItem): string {
  if (record.set_identifier) return record.set_identifier;
  if (record.routing_policy === "weighted" && record.weight !== null) return `Weight: ${record.weight}`;
  if (record.routing_policy === "latency" && record.region) return record.region;
  if (record.routing_policy === "failover" && record.failover) return record.failover;
  if (record.routing_policy === "geolocation") {
    return [record.geo_continent, record.geo_country, record.geo_subdivision].filter(Boolean).join("/") || "-";
  }
  return "-";
}

export function ZoneRecordsTab({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput);
  const typeFilter = searchParams.get("rtype") ?? "";
  const policyFilter = searchParams.get("policy") ?? "";
  const sortBy = (searchParams.get("sort_by") as RecordListParams["sort_by"]) ?? "name";
  const sortOrder = (searchParams.get("sort_order") as RecordListParams["sort_order"]) ?? "asc";

  const pagination = useCursorPagination();
  const [preferences, setPreferences] = useTablePreferences("r53-records-table", {
    pageSize: 50,
    wrapLines: false,
    contentDisplay: CONTENT_DISPLAY_DEFAULT,
  });

  const [selectedItems, setSelectedItems] = useState<RecordItem[]>([]);
  const [deletingRecord, setDeletingRecord] = useState<RecordItem | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const queryParams: RecordListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      type: typeFilter || undefined,
      routing_policy: policyFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page_size: preferences.pageSize,
      next_token: pagination.currentToken,
    }),
    [debouncedSearch, typeFilter, policyFilter, sortBy, sortOrder, preferences.pageSize, pagination.currentToken],
  );

  const { data, isLoading, isFetching } = useRecords(zoneId, queryParams);

  useEffect(() => {
    setSelectedItems((current) =>
      current.filter((item) => data?.items.some((row) => row.id === item.id)),
    );
  }, [data]);

  const columnDefinitions: TableProps.ColumnDefinition<RecordItem>[] = [
    {
      id: "name",
      header: "Record name",
      cell: (record) => record.name,
      sortingField: "name",
      isRowHeader: true,
      width: 240,
    },
    { id: "type", header: "Record type", cell: (record) => record.type, sortingField: "type", width: 100 },
    {
      id: "routing_policy",
      header: "Routing policy",
      cell: (record) => ROUTING_POLICY_LABELS[record.routing_policy as keyof typeof ROUTING_POLICY_LABELS] ?? record.routing_policy,
      width: 140,
    },
    { id: "differentiator", header: "Differentiator", cell: differentiatorFor, width: 140 },
    {
      id: "alias",
      header: "Alias",
      cell: (record) => (record.is_alias ? "Yes" : "No"),
      width: 80,
    },
    {
      id: "values",
      header: "Value",
      cell: (record) =>
        record.is_alias ? (
          record.alias_target ?? "-"
        ) : record.values.length > 0 ? (
          <SpaceBetween size="xxs">
            {record.values.map((value, index) => (
              <div key={`${record.id}-${index}`}>{value}</div>
            ))}
          </SpaceBetween>
        ) : (
          "-"
        ),
    },
    {
      id: "ttl",
      header: "TTL (seconds)",
      cell: (record) => record.ttl ?? "-",
      sortingField: "ttl",
      width: 130,
    },
    {
      id: "health_check_id",
      header: "Health check ID",
      cell: () => "-",
      width: 140,
    },
    {
      id: "evaluate_target_health",
      header: "Evaluate target health",
      cell: (record) => (record.is_alias ? (record.alias_evaluate_target_health ? "Yes" : "No") : "-"),
      width: 160,
    },
    { id: "id", header: "Record ID", cell: (record) => record.id, width: 260 },
    {
      id: "actions",
      header: "Actions",
      cell: (record) => (
        <SpaceBetween direction="horizontal" size="xs">
          <NavLink href={`/route53/hostedzones/${zoneId}/records/${record.id}/edit`}>Edit</NavLink>
          {record.is_system ? (
            <Popover
              triggerType="text"
              dismissButton={false}
              content="System record of this type cannot be deleted (docs/ROUTE53-DOMAIN-RULES.md R2)."
            >
              <Box color="text-status-inactive" display="inline">
                Delete
              </Box>
            </Popover>
          ) : (
            <Button variant="inline-link" onClick={() => setDeletingRecord(record)}>
              Delete
            </Button>
          )}
        </SpaceBetween>
      ),
      width: 140,
    },
  ];

  const sortingColumn =
    columnDefinitions.find((column) => column.sortingField === sortBy) ?? columnDefinitions[0];
  const visibleContentIds = preferences.contentDisplay.filter((c) => c.visible).map((c) => c.id);
  const deletableSelected = selectedItems.filter((item) => !item.is_system);

  return (
    <>
      <Table
        items={data?.items ?? []}
        trackBy="id"
        columnDefinitions={columnDefinitions}
        visibleColumns={visibleContentIds}
        wrapLines={preferences.wrapLines}
        stickyHeader
        loading={isLoading || isFetching}
        loadingText="Loading records"
        ariaLabels={{
          tableLabel: "Records table",
          selectionGroupLabel: "Records selection",
          itemSelectionLabel: (_data, item) => `Select ${item.name}`,
        }}
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        isItemDisabled={(record) => record.is_system}
        sortingColumn={sortingColumn}
        sortingDescending={sortOrder === "desc"}
        onSortingChange={({ detail }) => {
          if (!detail.sortingColumn.sortingField) return;
          updateParams({
            sort_by: detail.sortingColumn.sortingField,
            sort_order: detail.isDescending ? "desc" : "asc",
          });
        }}
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={[{ id: "delete", text: "Delete", disabled: deletableSelected.length === 0 }]}
                  onItemClick={({ detail }) => {
                    if (detail.id === "delete") setBulkDeleting(true);
                  }}
                >
                  Actions
                </ButtonDropdown>
                <NavLink href={`/route53/hostedzones/${zoneId}/records/create`} variant="primary">
                  Create record
                </NavLink>
              </SpaceBetween>
            }
            counter={selectedItems.length > 0 ? `(${selectedItems.length}/${data?.items.length ?? 0})` : undefined}
          >
            {`Records (${data?.items.length ?? 0})`}
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <TextFilter
              filteringText={searchInput}
              filteringPlaceholder="Filter records by property or value"
              filteringAriaLabel="Filter records by property or value"
              onChange={({ detail }) => setSearchInput(detail.filteringText)}
              countText={
                data ? `${data.items.length} match${data.items.length === 1 ? "" : "es"}` : undefined
              }
            />
            <Select
              selectedOption={TYPE_OPTIONS.find((option) => option.value === typeFilter) ?? TYPE_OPTIONS[0] ?? null}
              onChange={({ detail }) => updateParams({ rtype: detail.selectedOption.value ?? "" })}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by record type"
            />
            <Select
              selectedOption={POLICY_OPTIONS.find((option) => option.value === policyFilter) ?? POLICY_OPTIONS[0] ?? null}
              onChange={({ detail }) => updateParams({ policy: detail.selectedOption.value ?? "" })}
              options={POLICY_OPTIONS}
              ariaLabel="Filter by routing policy"
            />
          </SpaceBetween>
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
                { value: 10, label: "10 records" },
                { value: 50, label: "50 records" },
                { value: 100, label: "100 records" },
              ],
            }}
            wrapLinesPreference={{
              label: "Wrap lines",
              description: "Wrap long text and show all information.",
            }}
            contentDisplayPreference={{
              title: "Column preferences",
              options: columnDefinitions.map((column) => ({
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
              <Box variant="strong">No records</Box>
              <NavLink href={`/route53/hostedzones/${zoneId}/records/create`} variant="normal">
                Create record
              </NavLink>
            </SpaceBetween>
          </Box>
        }
      />
      <DeleteRecordModal
        zoneId={zoneId}
        record={deletingRecord}
        visible={deletingRecord !== null}
        onDismiss={() => setDeletingRecord(null)}
      />
      <BulkDeleteRecordsModal
        zoneId={zoneId}
        records={deletableSelected}
        visible={bulkDeleting}
        onDismiss={() => setBulkDeleting(false)}
        onSuccess={() => setSelectedItems([])}
      />
    </>
  );
}
