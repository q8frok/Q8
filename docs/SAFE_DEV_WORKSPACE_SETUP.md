# Q8 Safe Development Workspace Setup

Purpose: enable fast shipping while preventing accidental data leaks, unsafe automation, and production breakage.

## 1) Environment topology

Use 3 separate environments:

1. **local-dev** (Mac mini)
   - For coding and integration testing only
   - Uses test/sandbox credentials where possible
2. **staging** (Vercel Preview + staging DB)
   - All PRs deploy here
   - Mandatory validation gate before production
3. **production** (Vercel Production + prod DB)
   - Deploy from `main` only
   - Protected with approvals

## 2) Branch and deployment safety

- `main` is protected (no direct pushes)
- Work on feature branches only: `feat/*`, `fix/*`, `chore/*`
- Require PR checks before merge:
  - typecheck
  - lint
  - unit/integration tests
  - build
- Require at least one reviewer (human-in-the-loop)

## 3) Secret management policy

Never commit secrets. Use only environment variables.

Required secret scopes:
- **DEV**: test/sandbox keys only
- **STAGING**: staging keys only
- **PROD**: production keys only

Recommended variables (by domain):
- Core app: `NEXT_PUBLIC_*`, server keys, Supabase keys
- Google: OAuth client id/secret, refresh tokens
- Finance: Plaid client id/secret, webhook secret
- Ops: Square tokens, webhook signing secret
- Home: Home Assistant URL/token

## 4) Action guardrails (aligned to Minki policy)

- **Green (auto):** monitor, analyze, draft, summarize, remind
- **Yellow (approval once):** schedule drafts, order drafts, outreach drafts, automation rule changes
- **Red (always approval):** spending money, final external sends/orders, account/security changes

Implementation requirement:
- All external execution paths must pass through a centralized `approval_state` check.
- Red actions must fail-closed without explicit approval token.

## 5) Data safety and auditability

- Add immutable action log for all agent actions:
  - `timestamp`, `actor`, `action`, `source`, `approval_state`, `result`
- Persist run history for automation workflows (success/failure + reason)
- Keep personal finance and business data partitioned by schema/domain

## 6) Initial CI baseline

Required CI workflow on every PR:

```bash
pnpm install --frozen-lockfile
pnpm turbo typecheck
pnpm turbo lint
pnpm turbo test
pnpm turbo build
```

If tests are not fully wired, enforce at least:
- typecheck
- build

## 7) Local bootstrap (safe defaults)

```bash
cd Q8
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
# Fill DEV-only keys in apps/web/.env.local
pnpm turbo typecheck
pnpm turbo build
pnpm dev
```

## 8) Account mapping (current)

- Google app owner (current): `minkilee32@gmail.com`
- GitHub repo owner: `mlee0412/Q8`
- Vercel owner: personal account (same owner)
- Dedicated agent account (not yet integrated): `q8frok@gmail.com`

## 9) Integration rollout order (recommended)

1. Dashboard/core stabilization (CI green)
2. Reservation + calendar + email ingestion
3. Inventory/vendor workflow draft engine
4. Finance ingestion + anomaly detection
5. Home automation control plane
6. Approval UX + red-action enforcement everywhere

## 10) Definition of done for "safe environment ready"

- [ ] Protected `main` branch + required checks
- [ ] Staging and production environment variables separated
- [ ] Approval gates implemented for yellow/red actions
- [ ] Action log live in dashboard
- [ ] No plaintext secrets in repository history
- [ ] PR preview deployments active on Vercel
