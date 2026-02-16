# Windsurf Dev Workflow (Q8)

This file is for live collaboration so Minki can follow development in Windsurf.

## Project location

- Absolute path: `/Users/q8macmini/.openclaw/workspace/Q8`
- Git remote: `mlee0412/Q8`
- Default branch to watch: `main`

## Golden rule

- `main` is the stable branch.
- All implementation work happens in short-lived feature branches and merges back to `main` via PR.

## Recommended branch naming

- `feat/<scope>-<short-desc>`
- `fix/<scope>-<short-desc>`
- `chore/<scope>-<short-desc>`

Examples:
- `feat/finance-anomaly-engine-v1`
- `feat/home-assistant-policy-rules`
- `fix/calendar-ingestion-timezone`

## Safe local loop

```bash
cd /Users/q8macmini/.openclaw/workspace/Q8

# Confirm base branch
git checkout main
git pull --ff-only

# Create working branch
git checkout -b feat/<scope>-<desc>

# Install + verify
pnpm install --frozen-lockfile
pnpm turbo typecheck
pnpm turbo build

# Start app
pnpm dev
```

## Pre-PR quality gate

Run these before opening PR:

```bash
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo test
pnpm turbo build
```

## PR checklist

- [ ] Scope is small and clear
- [ ] No secrets committed
- [ ] Env vars documented in `.env.local.example`
- [ ] Build/typecheck pass locally
- [ ] PR description includes:
  - objective
  - files changed
  - risks
  - rollback plan

## Deployment model

- PR branch -> Vercel Preview (staging validation)
- Merge to `main` -> Production deployment

## Approval policy implementation rule

Every external execution path must include approval-state checks:

- Green: auto
- Yellow: ask once then run
- Red: always explicit approval token

Fail closed if approval state is missing.
