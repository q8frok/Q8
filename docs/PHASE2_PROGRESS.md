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

## Next

- Apply migration in staging and switch APIs from mock fallback to DB mode
- Connect Work Ops to real Gmail/Calendar/Square ingestion
- Connect Alerts to threshold evaluation jobs
