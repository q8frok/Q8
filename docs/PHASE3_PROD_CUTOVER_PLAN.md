# Phase 3 — Production Cutover Plan

## Objective
Promote Life OS Phase 2 stack from staging to production with minimal risk.

## Owners
- Release operator: Q8
- Approval owner: Minki
- Rollback owner: Q8

## Cutover sequence

### Step 0 — Freeze window
- Announce release window
- Pause nonessential schema changes

### Step 1 — Preflight
- Run release gate checklist (`PHASE3_RELEASE_GATE.md`)
- Confirm backup point exists

### Step 2 — Production migrations
Apply manually in Supabase SQL editor in this order:
1. 023
2. 024
3. 025
4. 026
5. 027

After each migration:
- Run endpoint smoke tests
- Record pass/fail

### Step 3 — App deploy
- Deploy branch containing Phase 2.9 completion
- Validate env and secrets
- Verify dashboard + widgets

### Step 4 — Pipeline activation
- Confirm cron target URL/port for production app
- Force-run one job
- Check `phase27/status` health and run details

### Step 5 — Policy validation
- Test Green/Yellow/Red path behavior
- Ensure yellow approval creates grant and later auto-exec works

### Step 6 — Go-live confirmation
- Capture post-cutover status summary
- Monitor for 2 scheduler cycles (60 minutes)

## Success criteria
- API routes healthy
- DB mode active for work-ops/alerts/approvals/thresholds
- Job run history and health metrics updating
- No recurring failures across 2 cycles

## Abort criteria
- Repeated 5xx on core Life OS routes
- Pipeline writes failing due to schema mismatch
- Approval queue/grant logic malfunctioning

If abort criteria hit, execute rollback runbook immediately.
