// Mirrors backend/app/schemas/record.py verbatim (docs/API.md §4). Phase 4 only reads
// this list for the zone-detail Records tab; create/edit/delete land in Phase 5.
export interface RecordItem {
  id: string;
  name: string;
  type: string;
  ttl: number | null;
  routing_policy: string;
  set_identifier: string | null;
  values: string[];
  is_alias: boolean;
  alias_target: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordListParams {
  // Index signature so this can pass through `keys.records()`/`buildQueryString()`,
  // which both take a plain `Record<string, ...>` (docs/API.md §4 query params).
  [key: string]: string | number | boolean | undefined;
  search?: string;
  type?: string;
  routing_policy?: string;
  alias_only?: boolean;
  page_size?: number;
  next_token?: string;
  sort_by?: "name" | "type" | "ttl" | "created_at";
  sort_order?: "asc" | "desc";
}

export interface RecordListResponse {
  items: RecordItem[];
  next_token: string | null;
}
