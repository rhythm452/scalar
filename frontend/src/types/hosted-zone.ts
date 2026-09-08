// Mirrors backend/app/schemas/hosted_zone.py verbatim (docs/API.md §3).
import type { TagItem } from "@/types/tag";

export type HostedZoneType = "public" | "private";

export interface HostedZoneListItem {
  id: string;
  name: string;
  comment: string | null;
  type: HostedZoneType;
  record_set_count: number;
  caller_reference: string;
  created_at: string;
}

export interface HostedZoneDetail extends HostedZoneListItem {
  vpc_id: string | null;
  vpc_region: string | null;
  updated_at: string;
}

export interface HostedZoneListParams {
  // Index signature so this can pass through `keys.hostedZones()`/`buildQueryString()`,
  // which both take a plain `Record<string, ...>` (docs/API.md §3 query params).
  [key: string]: string | number | boolean | undefined;
  search?: string;
  type?: HostedZoneType;
  page_size?: number;
  next_token?: string;
  sort_by?: "name" | "created_at" | "record_set_count";
  sort_order?: "asc" | "desc";
}

export interface HostedZoneListResponse {
  items: HostedZoneListItem[];
  next_token: string | null;
}

export interface CreateHostedZonePayload {
  name: string;
  type: HostedZoneType;
  comment?: string | null;
  vpc_id?: string | null;
  vpc_region?: string | null;
}

export interface HostedZoneCreateResponse {
  zone: HostedZoneDetail;
  change: null;
}

export interface HostedZoneGetResponse {
  zone: HostedZoneDetail;
  tags: TagItem[];
}

export interface HostedZoneUpdateResponse {
  zone: HostedZoneDetail;
}
