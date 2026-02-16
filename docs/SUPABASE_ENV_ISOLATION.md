# Supabase Environment Isolation (Safe Setup)

This project must use strict environment separation to avoid accidental production writes.

## 1) Environment model

Use three Supabase projects:

- **Local/Dev**: for local feature work and test data
- **Staging**: for preview deployments
- **Production**: live users/data only

## 2) Local `.env.local` policy

`apps/web/.env.local` must point to **dev/staging only**, never production.

Required local keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID`

## 3) Safety guard script

Run before migration/deploy actions:

```bash
pnpm supabase:safety
```

This checks:
- URL/project ID consistency
- project ID not listed as production in guard vars

## 4) Production guard variables (local-only)

Add these to `apps/web/.env.local` for protection:

```env
SUPABASE_PROD_PROJECT_ID="<prod-project-ref>"
SUPABASE_STAGING_PROJECT_ID="<staging-project-ref>"
```

If your active local project matches `SUPABASE_PROD_PROJECT_ID`, safety check fails.

## 5) Supabase CLI usage safety

Prefer explicit project ref per command to avoid accidental linked-target pushes:

```bash
# Safe: check current linked project
supabase status

# Safe: link dev/staging explicitly
supabase link --project-ref <dev-or-staging-ref>

# Push only after safety pass
pnpm supabase:safety
supabase db push
```

## 6) Vercel environment mapping

Set env vars separately in Vercel:

- **Development**: dev Supabase
- **Preview**: staging Supabase
- **Production**: production Supabase

Never copy production service role keys into Development/Preview.

## 7) Deployment discipline

1. Develop on feature branch
2. Validate local (`pnpm supabase:safety`)
3. Preview deploy + test
4. Merge to `main`
5. Production deploy

## 8) One-time onboarding checklist

- [ ] Create/confirm separate dev, staging, prod Supabase projects
- [ ] Fill `SUPABASE_PROD_PROJECT_ID` and `SUPABASE_STAGING_PROJECT_ID`
- [ ] Confirm local `.env.local` is NOT prod
- [ ] Configure Vercel env scopes correctly
- [ ] Run `pnpm supabase:safety` before migration commands
