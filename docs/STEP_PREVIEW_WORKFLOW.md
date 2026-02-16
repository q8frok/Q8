# Step-by-Step Preview Workflow (Fork Mode)

Repo mode: work only in fork (`origin = q8frok/Q8`) and keep upstream as reference.

## 1) Branch-per-step development

```bash
cd /Users/q8macmini/.openclaw/workspace/Q8
git checkout main
git pull --ff-only
git checkout -b feat/<step-name>
```

## 2) Local preview (Windsurf + browser)

```bash
cd /Users/q8macmini/.openclaw/workspace/Q8
pnpm install --frozen-lockfile
pnpm dev
```

Open: `http://localhost:3000`

## 3) Dev auth path (local only)

Set in `apps/web/.env.local`:

```env
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_USER_ID="dev-user-q8"
NEXT_PUBLIC_DEV_AUTH_EMAIL="dev@q8.local"
NEXT_PUBLIC_DEV_AUTH_NAME="Q8 Dev User"
```

This bypasses login UI and lets you test dashboard/features immediately.

## 4) Per-step preview artifact

For each step, produce one of:
- local screen recording/screenshot
- Vercel preview URL (if pushed)
- short changelog in PR description

## 5) Quality gate before push

```bash
pnpm turbo typecheck
pnpm turbo build
```

## 6) Push and cloud preview

```bash
git push -u origin feat/<step-name>
```

Then open PR in fork and use Vercel Preview URL for remote testing.

## 7) Merge policy

- Keep `main` stable
- Merge only after preview + sanity test pass
