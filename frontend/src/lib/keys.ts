// Central query-key factory (docs/ARCHITECTURE.md §5). Phase 4/5 hooks import the
// placeholder builders below rather than inventing their own key shapes.
export const keys = {
  session: () => ["session"] as const,
  summary: () => ["summary"] as const,
  hostedZones: (params?: Record<string, unknown>) => ["hosted-zones", params ?? {}] as const,
  zone: (id: string) => ["zone", id] as const,
  records: (zoneId: string, params?: Record<string, unknown>) =>
    ["records", zoneId, params ?? {}] as const,
  tags: (zoneId: string) => ["tags", zoneId] as const,
};
