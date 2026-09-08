// Mirrors backend/app/schemas/record.py verbatim (docs/API.md §4).
export interface RecordItem {
  id: string;
  name: string;
  type: string;
  ttl: number | null;
  routing_policy: string;
  set_identifier: string | null;
  weight: number | null;
  region: string | null;
  failover: "PRIMARY" | "SECONDARY" | null;
  geo_continent: string | null;
  geo_country: string | null;
  geo_subdivision: string | null;
  values: string[];
  is_alias: boolean;
  alias_target: string | null;
  alias_hosted_zone_id: string | null;
  alias_evaluate_target_health: boolean | null;
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

// Body shared by POST (create) and PUT (full-replace) (backend RecordSetWrite).
export interface RecordSetWritePayload {
  name: string;
  type: string;
  ttl: number | null;
  routing_policy: string;
  set_identifier: string | null;
  weight: number | null;
  region: string | null;
  failover: "PRIMARY" | "SECONDARY" | null;
  geo_continent: string | null;
  geo_country: string | null;
  geo_subdivision: string | null;
  is_alias: boolean;
  alias_target: string | null;
  alias_hosted_zone_id: string | null;
  alias_evaluate_target_health: boolean;
  values: string[];
}

export interface ChangeSummary {
  id: string;
  status: "PENDING" | "INSYNC";
  submitted_at: string;
}

export interface RecordWriteResponse {
  record: RecordItem;
  change: ChangeSummary;
}

export interface RecordDeleteResponse {
  change: ChangeSummary;
}

export type BatchAction = "CREATE" | "UPSERT" | "DELETE";

export interface BatchChangeItem {
  action: BatchAction;
  record?: RecordSetWritePayload;
  record_id?: string;
}

export interface BatchRequest {
  comment?: string | null;
  changes: BatchChangeItem[];
}

export interface BatchResultItem {
  action: BatchAction;
  record_id: string | null;
  error: string | null;
}

export interface BatchResponse {
  change: ChangeSummary;
  results: BatchResultItem[];
}
