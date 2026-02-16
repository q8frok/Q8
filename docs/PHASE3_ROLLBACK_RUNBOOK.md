# Phase 3 — Rollback Runbook

## Principles
- Roll forward is preferred when safe.
- If production correctness is at risk, disable job runner first, then rollback behavior.
- Keep user-visible operations stable over perfect schema rollback.

## Immediate containment (T+0)
1. Disable pipeline scheduler job:
   - `q8:lifeos-phase27-pipeline-runner`
2. Verify no further writes to `work_ops_snapshots`, `alert_events`, `lifeos_job_runs`.
3. Keep app online while isolating failing endpoint(s).

## Service containment options
- If only pipeline path fails:
  - keep widgets read-only; disable run trigger buttons in UI (hotfix)
- If approvals path fails:
  - fallback to simulation mode response with clear flag
- If schema mismatch fails:
  - deploy compatibility patch to avoid new columns/constraints

## Data rollback strategy
Prefer logical rollback (behavior toggles) over destructive DDL rollbacks.

### A) Behavioral rollback (recommended)
- Revert app commit to last known stable SHA
- Redeploy app
- Re-enable cron only after smoke tests pass

### B) Schema rollback (only when required)
Perform manual SQL carefully:
- Drop newly added indexes first if conflicting
- Keep tables unless they cause hard failures
- Avoid deleting historical run data unless necessary

## Verification after rollback
- `GET /api/lifeos/work-ops` succeeds
- `GET /api/lifeos/alerts` succeeds
- `GET /api/lifeos/approvals` succeeds
- Dashboard renders without fatal errors
- No cron-triggered failures every 30m

## Incident log template
- Start time:
- Trigger:
- Impacted endpoints:
- Containment action:
- Rollback commit/schema actions:
- Recovery validation:
- Follow-up fixes:
