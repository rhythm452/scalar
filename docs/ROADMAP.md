# ROADMAP

Phased build plan. Each phase lists deliverables, the docs sections it implements, and exit criteria. Later sessions will be instructed as "implement docs/X.md §N".

## Table of contents

1. Phase 0 — Repo + docs
2. Phase 1 — Backend models, migrations, repositories, services, rules, seed
3. Phase 2 — Backend routers, error envelope, pagination, integration tests
4. Phase 3 — Frontend shell
5. Phase 4 — Hosted zones
6. Phase 5 — Records
7. Phase 6 — Mocked sections inside the shell
8. Phase 7 — Bonus: import/export, dark mode, keyboard shortcuts
9. Phase 8 — E2E + visual regression + CI green
10. Phase 9 — Deploy, screenshots, demo recording, final polish

## 1. Phase 0 — Repo + docs

Deliverables: all repository scaffold files, real config files, docs set.
Docs sections: this ROADMAP, plus every doc in `docs/`.
Exit criteria: `tree` matches required structure; no `TODO`/`TBD` except screenshot/demo placeholders; CI file exists.
Status: in progress (this session).

## 2. Phase 1 — Backend: models, migrations, repositories, services, domain rules, seed

Deliverables:
- SQLAlchemy models matching `docs/DATABASE.md` §14
- Initial Alembic migration implementing DDL and indexes
- Repository layer (users, zones, records, tags, changes)
- Service layer with R1–R11 domain rules
- Idempotent seed script and security helpers
- Unit tests for services and rules

Docs sections: `DATABASE.md`, `ROUTE53-DOMAIN-RULES.md`, `ARCHITECTURE.md` §4/§6.
Exit criteria: `make test-backend` passes with >85% services/routers coverage; seed produces predictable data; all R1–R11 tested.

## 3. Phase 2 — Backend: API routers, error envelope, pagination, integration tests

Deliverables:
- Auth router + middleware dependency
- Hosted zones router with filters/cursor pagination
- Records router + batch router
- Changes router with simulated status
- Import/export endpoints (scaffold, parser later)
- AWS-shaped error envelope handler
- Integration tests

Docs sections: `API.md` §1–§8, `ARCHITECTURE.md` §3–§4.
Exit criteria: every API endpoint has a curl-working router and integration test; `make lint` passes; cursor pagination tested.

## 4. Phase 3 — Frontend shell

Deliverables:
- Cloudscape AppLayout, TopNavigation, SideNavigation, Breadcrumbs
- `/login` page + auth hooks + middleware
- API client, query client, query-key factory
- Theme/density provider and blocking script
- Segment loading/error boundaries

Docs sections: `UI-PARITY.md` §1/§2/§5, `ARCHITECTURE.md` §5/§7.
Exit criteria: Navigating between shell pages feels like AWS; login sets cookie and redirects; session persists across reload.

## 5. Phase 4 — Hosted zones

Deliverables:
- Zone list: Table, TextFilter, PropertyFilter, Pagination, CollectionPreferences, URL-synced state
- Create zone form
- Zone detail with Records / Details / Tags tabs
- Edit comment + tags
- Delete zone with confirm modal and HostedZoneNotEmpty guard
- Flashbar on every mutation

Docs sections: `UI-PARITY.md` §2–§4, `API.md` §3.
Exit criteria: Create → list → detail → edit → delete flow passes manual and unit tests; URL params restore state.

## 6. Phase 5 — Records

Deliverables:
- Records table with filters and pagination
- Quick-create and wizard create modes
- Edit SplitPanel drawer
- Delete + bulk delete
- Per-type validation messages
- Counter display in tabs

Docs sections: `UI-PARITY.md` §2–§4, `ROUTE53-DOMAIN-RULES.md` R1–R11.
Exit criteria: All 13 types create/edit/delete successfully; system records protected; CNAME conflict tested.

## 7. Phase 6 — Mocked sections inside the real shell

Deliverables:
- /healthchecks, /trafficpolicies, /resolver, /profiles, /domains pages
- Each inside AppLayout with correct breadcrumbs and Coming Soon container
- Dashboard links wired

Docs sections: `UI-PARITY.md` §2.
Exit criteria: All mocked routes render correct shell, navigation, and empty state.

## 8. Phase 7 — Bonus: BIND import/export, dark mode, keyboard shortcuts

Deliverables:
- BIND import endpoint (dnspython) with multipart UI
- BIND and JSON export endpoints with download UI
- Dark/light/density toggles, visual-refresh toggle
- Keyboard shortcuts (e.g. `/` focus filter, `?` help)

Docs sections: `API.md` §6, `UI-PARITY.md` §5.
Exit criteria: Import a sample zone file and export round-trips; dark mode toggles without flash; keyboard shortcuts covered in E2E.

## 9. Phase 8 — Playwright E2E + visual regression + CI green

Deliverables:
- All E2E scenarios from `docs/TESTING.md` §4
- Visual-regression baselines
- GitHub Actions green across backend/frontend/e2e

Docs sections: `TESTING.md` §5/§6.
Exit criteria: `make test`, `make lint`, `make e2e` all green in CI.

## 10. Phase 9 — Deploy, screenshots, demo recording, final polish

Deliverables:
- Deploy backend to Fly.io
- Deploy frontend to Vercel
- Capture screenshots into `docs/screenshots/`
- Record demo walkthrough
- Final UI-parity pass against real console captures
- Update README demo link and screenshots

Docs sections: `DEPLOYMENT.md`, `README.md` §6.
Exit criteria: Live demo URL works; README placeholders replaced; no P0/P1 bugs.
