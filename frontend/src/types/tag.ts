// Mirrors backend/app/schemas/tag.py verbatim (docs/API.md §3).
export interface TagItem {
  key: string;
  value: string;
}

export interface TagsResponse {
  tags: TagItem[];
}

export interface TagsReplacePayload {
  tags: TagItem[];
}
