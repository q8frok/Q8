# Phase 2 Progress — Life OS Dashboard Wiring

## Step 2.1 (completed)

- Added Life OS domain data contracts:
  - `apps/web/src/types/lifeos.ts`
- Added API endpoint for overview payload:
  - `GET /api/lifeos/overview`
  - file: `apps/web/src/app/api/lifeos/overview/route.ts`
- Wired `LifeOSDomainWidget` to fetch and render:
  - score
  - open items
  - urgent items
  - next action

## Preview

- Local URL: `http://localhost:3000`
- Domain panels now show live scaffold metrics from API contract.

## Step 2.2 (completed)

- Added Approval Center queue API contract:
  - `GET /api/lifeos/approvals`
  - `POST /api/lifeos/approvals` (approve/reject simulation)
- Added Approval Center widget with action buttons:
  - `apps/web/src/components/dashboard/widgets/ApprovalCenterWidget.tsx`

## Step 2.3 (completed)

- Added Work Ops API scaffold:
  - `GET /api/lifeos/work-ops`
- Added Alerts API scaffold:
  - `GET /api/lifeos/alerts`
- Added dedicated widgets:
  - `WorkOpsWidget`
  - `AlertsWidget`
- Wired dashboard to use these widgets for `work-ops` and `alerts` panels.

## Step 2.4 (in progress)

- Added DB-backed scaffold for approvals queue in API (`approval_queue` table with mock fallback)
- Added threshold config API (`/api/lifeos/thresholds`) with DB + mock fallback
- Added work-ops sources contract API (`/api/lifeos/work-ops/sources`)
- Added migration scaffold:
  - `infra/supabase/migrations/023_lifeos_phase2.sql`

## Step 2.5 (in progress)

- Added migration scaffold:
  - `024_lifeos_phase25.sql` (work_ops_snapshots, alert_events)
- Upgraded Work Ops API to DB-first (`work_ops_snapshots`) with mock fallback
- Added alerts evaluation endpoint scaffold:
  - `GET /api/lifeos/alerts/evaluate`
- Upgraded Alerts API to DB-first (`alert_events`) with mock fallback
- Approval actions now surface execution mode (`DB` vs `SIMULATION`) in widget UI

## Next

- Apply `024_lifeos_phase25.sql` in staging
- Populate `work_ops_snapshots` from actual connectors
- Persist evaluated alerts into `alert_events` on schedule
