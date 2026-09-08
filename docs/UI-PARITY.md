# UI-PARITY

This is the highest-weight specification: the checklist a reviewer's eye runs down against the real AWS Route 53 console. Every screen uses Cloudscape components only; Phase 3–7 implement this document section by section.

## Table of contents

1. Cloudscape mapping
2. Screen inventory
3. Copy fidelity
4. Interaction parity
5. Theming
6. Accessibility
7. Needs verification against screenshots

## 1. Cloudscape mapping

For every Route 53 UI element, the exact Cloudscape component that reproduces it. The `useCollection` hook from `@cloudscape-design/collection-hooks` drives filtering, sorting, pagination, and selection on every table, backed by server-side params from the URL.

| Route 53 element | Cloudscape component | Notes |
|------------------|---------------------|-------|
| Console frame | AppLayout (navigation + tools + content) | `navigationOpen` in React state; content type `table` on lists |
| Top bar with account menu | TopNavigation | Identity menu shows display_name + 12-digit account id |
| Left service nav | SideNavigation | Sections: Hosted zones, Health checks, Traffic policies, Resolver, Profiles, Domains |
| Breadcrumbs | BreadcrumbGroup | Every screen declares full trail (see §2) |
| Zone/record lists | Table + TextFilter + PropertyFilter + Pagination + CollectionPreferences | Server-side via useCollection with URL-synced params |
| Page headers with actions | Header + SpaceBetween | Primary action `Create hosted zone` / `Create record` top-right |
| Cards/panels | Container + ColumnLayout + KeyValuePairs | Zone details tab, dashboard cards |
| Forms | Form + FormField + Input + Select + Multiselect + RadioGroup + Textarea | Zone create, record quick/wizard forms |
| Buttons | Button + ButtonDropdown | Bulk delete via ButtonDropdown on record table |
| Confirm dialogs | Modal | Delete zone, delete record, bulk delete, unsaved changes |
| Notifications | Flashbar | Every mutation; dismissible; auto-dismiss success after 8 s. Every toast with activity metadata also appends a session-scoped entry (ADR-021) |
| Inline errors | Alert | Segment error boundaries + form-level API errors |
| Demo credentials alert | Alert type="info" | Intentional deviation from real AWS sign-in (ADR-015) |
| Activity feed (bell drawer) | AppLayout drawers slot | Intentional improvement over the real console: the empty reference shows nothing, while this panel lists the session's own zone/record actions with change ID/status. In-memory only, capped at 50, clears on reload |
| Detail tabs | Tabs | Records / Hosted zone details / Tags on zone detail |
| Status pills | StatusIndicator + Badge | PENDING (in-progress) vs INSYNC (success) change badges |
| Links | Link + Box | Cross-links between dashboard, lists, detail |
| Help side panel | HelpPanel | Per-screen help in AppLayout tools slot |
| Loading | Spinner | Segment loading.tsx + inline Table loadingText |
| Field help | Popover | TTL help, routing-policy help, alias help |
| Edit drawer | SplitPanel | Record edit page renders SplitPanel matching console drawer |
| Page shell | ContentLayout | Dashboard + detail pages |
| Dark/density control | applyMode from global-styles | Theme toggle in TopNavigation utilities |

## 2. Screen inventory

### /login (mock AWS sign-in)

Route `/login`. Title `Sign in`. Breadcrumb: none (standalone). Header: AWS-style centered Container with `Sign in` Header. Fields: `Username`, `Password` (type password). Action: primary Button `Sign in`, loading state `Signing in…`. Empty state: none. Loading: button spinner only. Errors: Alert `Invalid username or password.` on 401. On success redirect to `?next=` or `/route53`.

Demo-credentials note: directly under the header, render a Cloudscape `Alert` with `type="info"`, header `Demo credentials`, body `Username: admin / Password: password123`. This is an intentional, documented deviation from a real AWS sign-in page to remove login friction for judges (ADR-015).

### /route53 dashboard

Route `/route53`. Title `Route 53 Dashboard`. Breadcrumb: `Route 53`. Header actions: `Create hosted zone` (navigates to create), `View hosted zones`. Cards via ColumnLayout: `Hosted zones (N)`, `Records (N)`, `Health checks (0)`, `Traffic policies (0)` sourced from `GET /dashboard/summary`. Loading: per-card Spinner. Empty state: cards show 0, no table.

### /route53/hostedzones (list)

Route `/route53/hostedzones`. Title `Hosted zones`. Breadcrumb: `Route 53 / Hosted zones`. Header actions: `Create hosted zone` primary. Table columns with widths: `Domain name` (30%), `Type` (12%: Public/Private Badge), `Description` (28%), `Records` (10%, right-aligned number), `Created` (20%, relative date). Filter controls: TextFilter placeholder `Filter hosted zones` + PropertyFilter on Type + sort on Domain name/Created/Records. Empty state title `No hosted zones`, body `You don't have any hosted zones.`, action `Create hosted zone`. Loading: Table `loadingText="Loading hosted zones"`.

### /route53/hostedzones/create

Route `/route53/hostedzones/create`. Title `Create hosted zone`. Breadcrumb: `Route 53 / Hosted zones / Create`. Fields: `Domain name` (Input, help `Enter a fully qualified domain name, e.g. example.com.`), `Description - optional` (Input, maxLength 256, counter), `Type` RadioGroup: `Publicly routable in the internet` (description `A public hosted zone…`) vs `Private hosted zone` (reveals `VPC ID` + `VPC region` Selects). Actions: `Create hosted zone` primary + `Cancel`. Loading: button spinner; success Flashbar + navigate to detail.

### /route53/hostedzones/{id} (detail)

Route `/route53/hostedzones/{id}?tab=records|details|tags`. Title: zone name. Breadcrumb: `Route 53 / Hosted zones / {zone name}`. Tabs: `Records (N)`, `Hosted zone details`, `Tags`. Records tab embeds the records table with `Create record` primary + `Delete` (disabled without selection) + `Import/Export` ButtonDropdown. Details tab: KeyValuePairs (`Domain name`, `Type`, `Description`, `Hosted zone ID`, `Caller reference`, `Record count`, `Created`). Tags tab: Table `Key | Value` + `Edit tags` action opening Modal. Loading: ContentLayout Spinner; missing zone renders Alert + back Link.

### /route53/hostedzones/{id}/records/create

Route with `?mode=quick|wizard`, default quick. Title `Create record`. Breadcrumb: `Route 53 / Hosted zones / {zone} / Create record`. Modes: `Quick create record` (single-page Form) and `Switch to wizard` (stepped: Details → Values → Routing → Review). Fields: `Record name` (Input with apex hint), `Record type` (Select 13 types), `Value` (Textarea dynamic help per type), `TTL (seconds)` (Input numeric, hidden for alias), `Routing policy` (Select), `Set identifier` (conditional), `Evaluate target health` (RadioGroup Yes/No, alias only), Alias toggle revealing alias target fields. Actions: `Create record` + `Cancel`. Errors map per R7 to FormField `errorText`.

### /route53/hostedzones/{id}/records/{rid}/edit

Route edit. Title `Edit record`. Breadcrumb: `... / {record name} / Edit`. Layout: record Table behind a SplitPanel drawer matching the console's edit drawer (SplitPanel position side, width 400). Same fields as create, prefilled; name/type read-only when CNAME/affecting coexistence, noted via Popover. Actions: `Save` + `Cancel`; unsaved-changes Modal guard.

### Mocked: /route53/healthchecks, /trafficpolicies, /resolver, /profiles, /domains

Each route renders inside the real AppLayout shell with correct BreadcrumbGroup (`Route 53 / {Service}`), Header with service title, and a Container: title `Coming Soon`, body `Health checks are mocked in this clone. Hosted zones and records are fully functional.`, action Link `View hosted zones`. A shell-consistent Coming-Soon page scores; a blank page does not.

## 3. Copy fidelity

Exact strings from the real console that must appear verbatim:

`Create hosted zone`, `Domain name`, `Description - optional`, `Type`, `Publicly routable in the internet`, `Private hosted zone`, `Records (N)`, `Create record`, `Quick create record`, `Switch to wizard`, `Record name`, `Record type`, `Value`, `TTL (seconds)`, `Routing policy`, `Evaluate target health`, `Delete record`, `Filter records by property or value`, `No records`, `No hosted zones`, `You don't have any hosted zones.`

Mutation flashbars use AWS phrasing: `Hosted zone created: example.com.`, `Record created: www.example.com. A (Change CXXXXXXXXXXXXX, status PENDING).`, `Hosted zone deleted.`, each dismissible. Strings were drafted from public console knowledge; each must be checked against captures in `docs/screenshots/` and any mismatch fixed before Phase 9; unverified items are listed in §7.

## 4. Interaction parity

1. Flashbar notification on every mutation with AWS phrasing, change ID where applicable, and dismiss button; success auto-dismisses after 8 s, errors persist.
2. Table row selection with header checkbox, bulk delete via ButtonDropdown opening a Modal listing selected names, per-item result reporting.
3. Column preferences via CollectionPreferences modal (page size, visible columns, wrap lines); persisted to localStorage per table id.
4. Sticky table header (`stickyHeader`) on zone and record tables.
5. URL-synced filter and page state: every TextFilter/PropertyFilter/sort/page change calls `router.replace` with updated params; reload and back/forward restore the view.
6. Unsaved-changes guard: navigating away from dirty zone/record forms opens a Modal `Discard changes?` with `Discard` / `Keep editing`.

## 5. Theming

Cloudscape light/dark via `applyMode(Mode.Dark | Mode.Light)` from `@cloudscape-design/global-styles`, plus density (`comfortable`/`compact`) and visual-refresh mode toggle. Controls live in the TopNavigation utilities menu; choice persists in a cookie + localStorage and is applied by a blocking inline script to avoid flash. Playwright `dark-mode` project asserts both themes (§7 of TESTING).

## 6. Accessibility

Keyboard navigation across nav, tables (arrow + space selection), modals (focus trap, Escape closes, focus returns to trigger), and wizard steps. Focus management on modal open/close handled by Cloudscape natively and asserted in E2E. ARIA labels on every collection component: `ariaLabel` for Table (`Hosted zones table`, `Records table`), TextFilter (`Filter hosted zones`), Pagination (`Hosted zones pagination`), and Refresh. Color contrast relies on Cloudscape tokens; custom CSS must not override token contrast pairs.

## 7. Needs verification against screenshots

The following items are unverified and will be reconciled against reference captures before Phase 4 begins:

1. Exact casing of `Description - optional` vs `Description - optional` with em-dash.
2. Whether the records filter placeholder reads `Filter records by property or value` verbatim including the leading verb.
3. Exact wizard step titles for record creation (drafted as Details/Values/Routing/Review).
4. Exact wording of the empty-zone body beyond `You don't have any hosted zones.`
5. Whether zone detail tabs read `Hosted zone details` vs `Details`.
6. Phase 4 implements the hosted-zones list's "Type" filter as a plain
   Cloudscape `Select` rather than a `PropertyFilter` (§1's Cloudscape mapping)
   -- a single equality filter doesn't need PropertyFilter's token/operator
   machinery, and the resulting UI is behaviorally equivalent (a dropdown next
   to the TextFilter). Revisit if a screenshot shows the real console using
   PropertyFilter's token-chip style for this specific filter.

The reference screenshots have not yet been supplied. Once they land in `docs/screenshots/`, update this section and any mismatched copy in the implementation.
