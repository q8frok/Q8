# /test — Quality Gate Runner

Run the full quality gate pipeline for the Q8 project.

## Steps

1. Run TypeScript type checking:
   ```bash
   pnpm turbo typecheck
   ```
2. If typecheck passes, run the test suite:
   ```bash
   pnpm test -- run
   ```
3. If tests pass, run build verification:
   ```bash
   pnpm turbo build --filter=@q8/web
   ```
4. Report results: list any failures with file paths and error messages.

## Rules
- Stop on first failure and report clearly what broke.
- Never skip typecheck — it's the first gate.
- If the user passes a path argument (e.g., `/test src/lib/agents`), scope the test run to that path only but still run full typecheck and build.
