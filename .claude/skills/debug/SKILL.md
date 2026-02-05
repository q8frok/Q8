# /debug — Debugging Workflow

Systematic debugging workflow for Q8 issues.

## Steps

1. **Reproduce:** Understand and describe the issue.
2. **Gather context:**
   - Check TypeScript errors: `pnpm turbo typecheck`
   - Check build errors: `pnpm turbo build --filter=@q8/web`
   - Check runtime logs if dev server is running
   - Check browser console errors if applicable
3. **Narrow scope:**
   - Identify the component/module involved
   - Read the relevant source code
   - Check recent git changes: `git log --oneline -10`
   - Check for related RxDB/Supabase schema mismatches
4. **Diagnose:**
   - Trace the data flow (UI → RxDB → Supabase → Agents)
   - Check for hydration mismatches (SSR vs client state)
   - Verify environment variables are set
5. **Fix:** Apply the minimal fix.
6. **Verify:** Run quality gates after fixing.

## Common Q8 Issues
- **Hydration mismatch:** RxDB hooks in SSR — use `'use client'` directive and conditional rendering.
- **Sync failures:** Check `lib/sync/pull.ts` and `push.ts` — verify Supabase connection and RLS policies.
- **Type errors after schema change:** Update all three: RxDB schema, Supabase migration, TypeScript interface.
- **Agent routing issues:** Check orchestrator handoff config in `lib/agents/index.ts`.

## Rules
- Always reproduce before fixing.
- Minimal fix — don't refactor while debugging.
- Run quality gates after every fix attempt.
