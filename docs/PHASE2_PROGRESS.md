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

## Step 2.7 (in progress)

- Added pipeline helper module for shared ingest/generation logic:
  - `src/lib/lifeos/pipeline.ts`
- Added job run APIs:
  - `POST /api/lifeos/jobs/phase27/run`
  - `GET /api/lifeos/jobs/phase27/status`
- Added migration scaffold:
  - `025_lifeos_phase27_job_runs.sql`
- Added widget controls:
  - Work Ops: auto-check pipeline status + interval check + run ingest button
  - Alerts: generate alerts button

## Phase 2.8 (completed in staging/dev)

- Pipeline trigger scheduled via OpenClaw cron every 30 minutes.
- Replaced placeholder alert metrics in `src/lib/lifeos/pipeline.ts`:
  - `dining_spend_delta_pct_7d` computed from `finance_transactions` (current 7d vs previous 7d, dining-classified transactions).
  - `night_scene_missed_count_24h` derived from `alert_events` (domain=`home`, 24h window).
- Replaced staffing placeholders with calendar-derived staffing signals:
  - `staffing_scheduled` from today shift/staff events
  - `staffing_clocked_in` from currently active shift/staff events
- Added provenance/idempotency migration scaffold:
  - `026_lifeos_phase28_provenance.sql` (`source_record_id`, `captured_at`, `ingestion_version`, unique index)
- Added idempotent upsert + backward-compatible insert fallback in ingest pipeline.
- Added run observability upgrades:
  - `phase27/run` stores `details.metrics`
  - `phase27/status` returns `health24h` (runs, success rate, avg duration, consecutive failures)
- Added consecutive-failure guard:
  - emits critical alert event after 2 consecutive pipeline failures.

## Next (Phase 2.9)

- Apply `026_lifeos_phase28_provenance.sql` in staging SQL editor.
- Enforce approval gate in runtime dispatcher (Green auto, Yellow ask once, Red always block).
- Promote connector provenance across all domains (`source_record_id` everywhere ingestion writes).
- Add production release gate + rollback checklist and runbook.
