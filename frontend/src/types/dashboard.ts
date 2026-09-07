// Mirrors backend/app/schemas/mocked.py verbatim (docs/API.md §7).
export interface DashboardSummary {
  zones: number;
  records: number;
  health_checks: number;
  traffic_policies: number;
}
