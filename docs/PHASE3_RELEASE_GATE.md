# Phase 3 — Release Gate Checklist (Staging -> Production)

## Goal
Promote Life OS Phase 2 foundation to production with a controlled, reversible rollout.

## Scope covered
- Life OS APIs and widgets (work-ops, approvals, alerts, thresholds)
- Pipeline job runner (`phase27/run`, `phase27/status`)
- Approval policy dispatcher + grants
- DB migrations: 023, 024, 025, 026, 027

---

## 1) Preflight (must pass)
- [ ] Branch clean and pushed (`feat/dev-auth-preview-workflow`)
- [ ] Staging app healthy (no blocking runtime errors)
- [ ] Pipeline cron running every 30m and succeeding
- [ ] `/api/lifeos/jobs/phase27/status` shows healthy metrics (24h)
- [ ] No pending migration conflicts in staging

## 2) Schema readiness (staging already verified)
- [x] 023 approvals/thresholds
- [x] 024 work_ops_snapshots + alert_events
- [x] 025 lifeos_job_runs
- [x] 026 provenance/idempotency columns/indexes
- [x] 027 approval_grants

## 3) Production pre-checks
- [ ] Confirm production project ref is correct
- [ ] Confirm production env vars present and valid
- [ ] Verify service-role/anon keys loaded in deployment target
- [ ] Verify prod cron runner target URL/port is correct
- [ ] Capture pre-release DB backup/snapshot point

## 4) Production migration order (manual SQL editor)
Apply in strict order:
1. 023_lifeos_phase2.sql
2. 024_lifeos_phase25.sql
3. 025_lifeos_phase27_job_runs.sql
4. 026_lifeos_phase28_provenance.sql
5. 027_lifeos_phase29_approval_grants.sql

Validation after each:
- [ ] SQL success
- [ ] table/index existence spot-check
- [ ] app endpoint smoke test still passes

## 5) Endpoint smoke tests (prod)
- [ ] `GET /api/lifeos/overview`
- [ ] `GET /api/lifeos/approvals`
- [ ] `POST /api/lifeos/approvals` (approve/reject on test row)
- [ ] `GET /api/lifeos/work-ops`
- [ ] `GET /api/lifeos/work-ops/sources`
- [ ] `GET /api/lifeos/alerts`
- [ ] `GET /api/lifeos/thresholds`
- [ ] `POST /api/lifeos/jobs/phase27/run`
- [ ] `GET /api/lifeos/jobs/phase27/status`

## 6) Policy checks
- [ ] Green candidate -> auto action recorded
- [ ] Yellow candidate -> approval queued (first run)
- [ ] Yellow approved -> grant created -> subsequent auto action allowed
- [ ] Red candidate -> always blocked + approval queued

## 7) UX checks
- [ ] Dashboard loads with no crash
- [ ] Work Ops widget shows DB mode
- [ ] Alerts widget shows DB mode
- [ ] Approvals widget shows DB mode and actions succeed
- [ ] Settings “Reset to Phase 2 Layout” works

## 8) Rollout decision
- [ ] GO decision logged
- [ ] Rollback owner assigned
- [ ] Communication template ready (status + next checkpoint)

---

## Exit criteria
Release gate is complete when all checks pass and prod pipeline run is successful with DB-backed status + health metrics visible.
