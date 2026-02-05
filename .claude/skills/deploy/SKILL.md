# /deploy — Production Deployment

Deploy the Q8 web app to Vercel.

## Steps

1. Run the full quality gate pipeline first (typecheck, tests, build):
   ```bash
   pnpm turbo typecheck
   pnpm test -- run
   pnpm turbo build --filter=@q8/web
   ```
2. Check git status — warn if there are uncommitted changes.
3. Deploy to Vercel:
   ```bash
   vercel --prod
   ```
4. Report the deployment URL.

## Rules
- NEVER deploy if quality gates fail.
- NEVER deploy if there are uncommitted changes — ask the user first.
- If no Vercel CLI is installed, instruct the user to install it.
