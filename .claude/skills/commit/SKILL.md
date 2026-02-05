# /commit — Quality-Gated Commit

Commit workflow that enforces quality gates before committing.

## Steps

1. Run quality gates:
   ```bash
   pnpm turbo typecheck
   pnpm turbo build --filter=@q8/web
   ```
2. If quality gates fail, stop and report the errors. Do NOT commit.
3. If quality gates pass, show `git status` and `git diff --staged` to review changes.
4. Stage the relevant files (prefer specific files over `git add -A`).
5. Generate a commit message following conventional commits:
   - `feat:` new feature
   - `fix:` bug fix
   - `refactor:` code restructuring
   - `docs:` documentation
   - `test:` test changes
   - `chore:` maintenance
6. Create the commit.
7. Show the result with `git log --oneline -1`.

## Rules
- NEVER skip quality gates.
- NEVER commit if typecheck fails.
- NEVER use `git add -A` — stage specific files.
- NEVER commit `.env` files or secrets.
- Ask the user to confirm the commit message before committing.
- If the user provides a message argument (e.g., `/commit fix auth bug`), use it as the basis for the commit message.
