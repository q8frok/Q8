# Code Quality Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all code quality issues found in the comprehensive review: ESLint hardening, type safety, security headers, error handling, API consistency, god component refactoring, and test coverage expansion.

**Architecture:** Incremental improvements across 10 tasks, ordered by dependency and risk. Each task is self-contained and independently committable. Security and config changes first, then refactors, then tests last (since tests validate the refactored code).

**Tech Stack:** TypeScript, ESLint, Next.js config, Vitest, React Testing Library

---

### Task 1: Enhance ESLint Configuration

**Files:**
- Modify: `apps/web/.eslintrc.json`
- Modify: `apps/web/package.json` (if dev deps needed)

**Step 1: Write the failing lint test**

Run the current lint to establish baseline:
```bash
pnpm turbo lint 2>&1 | tail -20
```
Expected: PASS (current minimal config catches nothing)

**Step 2: Update ESLint config**

Replace `apps/web/.eslintrc.json` with:
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error"
  },
  "overrides": [
    {
      "files": ["tests/**/*"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

**Step 3: Install missing dev dependencies if needed**

```bash
cd apps/web && pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Step 4: Run lint and fix any new violations**

```bash
pnpm turbo lint
```
Expected: May surface violations from the new rules. Fix them in subsequent steps.

**Step 5: Run typecheck and build to verify no regressions**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/.eslintrc.json apps/web/package.json
git commit -m "chore: harden ESLint config with TypeScript strict rules"
```

---

### Task 2: Fix `any` Type Violation

**Files:**
- Modify: `apps/web/src/hooks/useTasksEnhanced.ts:16`

**Step 1: Read the current code around line 16**

Understand the RxDB selector usage and what types are needed.

**Step 2: Write the failing typecheck**

After Task 1's ESLint `no-explicit-any` rule is active, this line will fail lint:
```typescript
const selector: Record<string, any> = {  // line 16
```

Run: `pnpm turbo lint`
Expected: FAIL on `useTasksEnhanced.ts:16` with `@typescript-eslint/no-explicit-any`

**Step 3: Fix the type**

Replace line 16 in `apps/web/src/hooks/useTasksEnhanced.ts`:
```typescript
// Before:
const selector: Record<string, any> = {

// After:
const selector: Record<string, unknown> = {
```

If `unknown` causes downstream type errors, create a specific interface:
```typescript
interface TaskSelector {
  user_id: string;
  deleted_at?: { $exists: boolean };
  parent_task_id?: { $exists: boolean } | string;
}
const selector: TaskSelector = {
```

**Step 4: Run lint + typecheck to verify**

```bash
pnpm turbo lint && pnpm turbo typecheck
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/hooks/useTasksEnhanced.ts
git commit -m "fix: replace any type with strict interface in useTasksEnhanced"
```

---

### Task 3: Add Root ErrorBoundary

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

**Context:** The root layout at `apps/web/src/app/layout.tsx` currently renders children directly without an ErrorBoundary. The project already has `components/shared/ErrorBoundary.tsx` available.

**Step 1: Read the existing ErrorBoundary component**

Read `apps/web/src/components/shared/ErrorBoundary.tsx` to understand its props interface.

**Step 2: Modify root layout**

In `apps/web/src/app/layout.tsx`, wrap `SessionManager` children with ErrorBoundary:

```tsx
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// In the body, wrap like:
<body className="antialiased">
  <PWAInitializer />
  <ErrorBoundary>
    <SessionManager>
      {children}
      <SyncStatus />
      <OfflineIndicator />
    </SessionManager>
  </ErrorBoundary>
</body>
```

**Step 3: Run typecheck and build**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "fix: wrap root layout with ErrorBoundary for crash recovery"
```

---

### Task 4: Add Security Headers to Next.js Config

**Files:**
- Modify: `apps/web/next.config.js`

**Step 1: Read current next.config.js**

Already verified: no `headers` config exists.

**Step 2: Add security headers**

Add a `headers` function to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    // ... existing config unchanged
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};
```

Note: `microphone=(self)` because the app has voice features. Do NOT add `X-XSS-Protection` as it's deprecated and can cause issues in modern browsers.

**Step 3: Run build to verify**

```bash
pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 4: Verify headers in dev**

```bash
cd apps/web && pnpm dev &
curl -I http://localhost:3000 2>/dev/null | grep -i "x-content-type\|x-frame\|referrer"
```
Expected: Headers visible in response

**Step 5: Commit**

```bash
git add apps/web/next.config.js
git commit -m "security: add protective HTTP headers to Next.js config"
```

---

### Task 5: Standardize API Error Responses

**Files:**
- Create: `apps/web/src/lib/api/error-responses.ts`
- Modify: 5-10 API routes to use the new helper (start with highest-traffic routes)

**Context:** API routes currently return inconsistent error formats. Some use `{ error: string }`, others add `{ error, details }`, others expose internal error messages. Need a single consistent format.

**Step 1: Write the failing test**

Create `apps/web/tests/lib/api/error-responses.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  rateLimitedResponse,
} from '@/lib/api/error-responses';

describe('API Error Responses', () => {
  it('returns consistent error format with code and message', async () => {
    const res = errorResponse('Something failed', 500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something failed' },
    });
    expect(res.status).toBe(500);
  });

  it('returns 401 for unauthorized', async () => {
    const res = unauthorizedResponse();
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(res.status).toBe(401);
  });

  it('returns 404 for not found', async () => {
    const res = notFoundResponse('Task');
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Task');
    expect(res.status).toBe(404);
  });

  it('returns 429 for rate limited', async () => {
    const res = rateLimitedResponse();
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(res.status).toBe(429);
  });

  it('returns 400 for validation errors with details', async () => {
    const mockZodError = {
      flatten: () => ({
        fieldErrors: { message: ['Required'] },
      }),
    };
    const res = validationErrorResponse(mockZodError as never);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/lib/api/error-responses.test.ts
```
Expected: FAIL - module not found

**Step 3: Write the error response helper**

Create `apps/web/src/lib/api/error-responses.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function errorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse<{ error: ApiError }> {
  const errorCode = code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  return NextResponse.json({ error: { code: errorCode, message } }, { status });
}

export function unauthorizedResponse(): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  );
}

export function notFoundResponse(resource: string): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
    { status: 404 }
  );
}

export function rateLimitedResponse(): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429 }
  );
}

export function validationErrorResponse(
  zodError: ZodError | { flatten: () => unknown }
): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: zodError.flatten(),
      },
    },
    { status: 400 }
  );
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- tests/lib/api/error-responses.test.ts
```
Expected: PASS

**Step 5: Migrate highest-traffic API routes**

Update these routes to use the new helpers (one at a time):
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/api/tasks/[id]/route.ts`
- `apps/web/src/app/api/sync/pull/route.ts`
- `apps/web/src/app/api/sync/push/route.ts`
- `apps/web/src/app/api/github/route.ts`

For each route, replace inline `NextResponse.json({ error: ... })` calls with the appropriate helper. Also check if `apps/web/src/lib/auth/api-auth.ts` has its own `unauthorizedResponse` - if so, update it to use the shared one or alias.

**Step 6: Run full test suite + typecheck + build**

```bash
pnpm turbo typecheck && pnpm test -- run && pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 7: Commit**

```bash
git add apps/web/src/lib/api/error-responses.ts apps/web/tests/lib/api/error-responses.test.ts apps/web/src/app/api/
git commit -m "refactor: standardize API error response format across routes"
```

---

### Task 6: Improve Hook Error Surfacing

**Files:**
- Modify: `apps/web/src/hooks/useTasksEnhanced.ts`
- Modify: `apps/web/src/hooks/useNotes.ts`
- Test: `apps/web/tests/hooks/useTasksEnhanced.test.ts` (create)

**Context:** Several hooks catch errors and log them but never surface them to the UI. This causes silent failures where the user has no feedback.

**Step 1: Read the hooks to understand current error patterns**

Read `useTasksEnhanced.ts` and `useNotes.ts` to identify all catch blocks that silently swallow errors.

**Step 2: Write failing test for error surfacing**

Create `apps/web/tests/hooks/useTasksEnhanced.test.ts` (or extend existing if one exists at `apps/web/tests/hooks/`):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Test that the hook exposes error state
describe('useTasksEnhanced error handling', () => {
  it('exposes lastError when createTask fails', async () => {
    // Mock RxDB to throw on insert
    // Render hook
    // Call createTask with invalid data
    // Assert lastError is set
    // Assert lastError can be cleared
  });
});
```

The exact test implementation depends on the hook's internal structure. Read the hook first, then write the test against its actual API.

**Step 3: Add error state to hooks**

Pattern to apply in each hook that silently catches:
```typescript
// Add to hook state:
const [lastError, setLastError] = useState<Error | null>(null);
const clearError = useCallback(() => setLastError(null), []);

// In catch blocks, replace:
//   logger.error('...', { error });
//   return null;
// With:
//   logger.error('...', { error });
//   setLastError(error instanceof Error ? error : new Error(String(error)));
//   return null;

// Add to return value:
return { ...existingReturn, lastError, clearError };
```

**Step 4: Run tests**

```bash
pnpm test -- run && pnpm turbo typecheck
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/hooks/useTasksEnhanced.ts apps/web/src/hooks/useNotes.ts apps/web/tests/hooks/
git commit -m "fix: surface error state from hooks instead of silent catch"
```

---

### Task 7: Refactor CalendarWidget (482 lines)

**Files:**
- Modify: `apps/web/src/components/dashboard/widgets/CalendarWidget/index.tsx`
- Create: `apps/web/src/components/dashboard/widgets/CalendarWidget/CalendarCompactView.tsx`
- Create: `apps/web/src/components/dashboard/widgets/CalendarWidget/CalendarExpandedView.tsx`
- Create: `apps/web/src/components/dashboard/widgets/CalendarWidget/CalendarModals.tsx`
- Create: `apps/web/src/components/dashboard/widgets/CalendarWidget/useCalendarNavigation.ts`

**Context:** CalendarWidget at 482 lines handles compact view, expanded view, modal orchestration, date navigation, and event filtering all in one file. Target: main index.tsx under 120 lines.

**Step 1: Read the full CalendarWidget**

Read `apps/web/src/components/dashboard/widgets/CalendarWidget/index.tsx` completely. Map out:
- Which lines handle compact view rendering
- Which lines handle expanded view rendering
- Which lines handle modals (add, detail, delete)
- Which lines handle date navigation state
- Which lines handle event filtering

**Step 2: Extract date navigation hook**

Create `useCalendarNavigation.ts` - extract all date state, navigation handlers (goToday, goNext, goPrev), and date label memo into a custom hook.

**Step 3: Extract compact view**

Create `CalendarCompactView.tsx` - move the compact rendering section into its own component. Pass needed props from parent.

**Step 4: Extract expanded view**

Create `CalendarExpandedView.tsx` - move the expanded rendering section (the largest block, ~150-190 lines) into its own component.

**Step 5: Extract modals**

Create `CalendarModals.tsx` - move modal rendering (QuickAdd, EventDetail, DeleteConfirm) into a single component that manages modal state.

**Step 6: Slim down index.tsx**

The main `index.tsx` should now only:
- Import sub-components
- Call `useCalendarNavigation`
- Render `<CalendarCompactView />` or `<CalendarExpandedView />` based on mode
- Render `<CalendarModals />`

Target: ~80-120 lines.

**Step 7: Run typecheck + build**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 8: Visual verification**

```bash
cd apps/web && pnpm dev
```
Open browser, verify CalendarWidget renders identically in both compact and expanded modes.

**Step 9: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/CalendarWidget/
git commit -m "refactor: decompose CalendarWidget into focused sub-components"
```

---

### Task 8: Refactor FinanceHubWidget (348 lines)

**Files:**
- Modify: `apps/web/src/components/dashboard/widgets/FinanceHubWidget/index.tsx`
- Create: `apps/web/src/components/dashboard/widgets/FinanceHubWidget/FinanceCompactView.tsx`
- Create: `apps/web/src/components/dashboard/widgets/FinanceHubWidget/FinanceExpandedView.tsx`

**Context:** Same pattern as CalendarWidget. FinanceHubWidget at 348 lines mixes compact/expanded views and state management.

**Step 1: Read the full FinanceHubWidget**

Read `apps/web/src/components/dashboard/widgets/FinanceHubWidget/index.tsx`. Map compact vs expanded rendering blocks.

**Step 2: Extract compact view**

Create `FinanceCompactView.tsx` with the compact rendering logic.

**Step 3: Extract expanded view**

Create `FinanceExpandedView.tsx` with the expanded rendering logic.

**Step 4: Slim down index.tsx**

Target: ~80-120 lines. The main component should orchestrate sub-components and manage shared state.

**Step 5: Run typecheck + build**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web
```
Expected: PASS

**Step 6: Visual verification**

Open dev server and verify FinanceHubWidget renders correctly in both modes.

**Step 7: Commit**

```bash
git add apps/web/src/components/dashboard/widgets/FinanceHubWidget/
git commit -m "refactor: decompose FinanceHubWidget into focused sub-components"
```

---

### Task 9: Refactor Large Chat Components

**Files:**
- Modify: `apps/web/src/components/chat/StreamingMessage.tsx` (577 lines)
- Modify: `apps/web/src/components/chat/ToolExecutionChip.tsx` (550 lines)
- Modify: `apps/web/src/components/chat/UnifiedConversation.tsx` (503 lines)

**Context:** Three chat components exceed 500 lines each. These need decomposition but are more complex since they handle streaming state. Approach carefully.

**Step 1: Read all three components**

Read each file completely. For each, identify:
- Rendering blocks that can become sub-components
- State that can be extracted into hooks
- Utility functions that can be extracted

**Step 2: Refactor StreamingMessage (577 lines)**

Likely extraction targets:
- Markdown rendering logic → separate utility or component
- Code block rendering → `CodeBlock.tsx`
- Image/media rendering → `MediaContent.tsx`
- Tool execution display → already has ToolExecutionChip

Target: under 200 lines.

**Step 3: Refactor ToolExecutionChip (550 lines)**

Likely extraction targets:
- Individual tool type renderers (each tool type gets its own small component)
- Status indicator logic → utility function
- Animation/transition logic → extracted

Target: under 200 lines.

**Step 4: Refactor UnifiedConversation (503 lines)**

Likely extraction targets:
- Message list rendering → `MessageList.tsx`
- Input area → already has ChatInput
- Thread header → `ConversationHeader.tsx`
- Scroll management → custom hook

Target: under 200 lines.

**Step 5: Run typecheck + build after each refactor**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web
```
Expected: PASS after each sub-step

**Step 6: Visual verification**

Test the chat interface end-to-end in dev mode to verify no rendering regressions.

**Step 7: Commit each refactor separately**

```bash
git commit -m "refactor: decompose StreamingMessage into focused sub-components"
git commit -m "refactor: decompose ToolExecutionChip into focused sub-components"
git commit -m "refactor: decompose UnifiedConversation into focused sub-components"
```

---

### Task 10: Expand Test Coverage

**Files:**
- Create: Multiple test files in `apps/web/tests/`

**Context:** Currently 13 test files for 566 source files. Priority areas for new tests based on risk assessment.

**Step 1: Audit existing test coverage**

```bash
cd apps/web && pnpm test -- run --coverage
```
Review the coverage report to identify the biggest gaps.

**Step 2: Add API route tests (highest risk)**

Create tests for the most critical API routes. Priority order:

1. `tests/api/chat.test.ts` - Test POST /api/chat with:
   - Valid message → 200 with response
   - Missing auth → 401
   - Invalid body → 400 validation error
   - Mock the LLM response (never call real API)

2. `tests/api/sync-pull.test.ts` - Test POST /api/sync/pull with:
   - Valid collection pull → 200 with documents
   - Unknown collection → 400
   - Missing auth → 401

3. `tests/api/sync-push.test.ts` - Test POST /api/sync/push with:
   - Valid document push → 200
   - Conflict resolution → 200 with conflict info
   - Missing auth → 401

4. `tests/api/tasks.test.ts` - Test CRUD /api/tasks with:
   - Create task → 201
   - Get task → 200
   - Update task → 200
   - Delete task → 200
   - Not found → 404

**Step 3: Add hook tests (high risk)**

Priority hooks to test:

1. `tests/hooks/useChat.test.ts` - Test:
   - Initial state
   - Send message updates state
   - Streaming message handling
   - Error handling
   - Cancel stream

2. `tests/hooks/useSyncStatus.test.ts` - Test:
   - Initial sync state
   - Sync in progress state
   - Sync error state
   - Sync complete state

3. `tests/hooks/useNotes.test.ts` - Test:
   - CRUD operations
   - Error surfacing (from Task 6)
   - Folder management

**Step 4: Add component tests (medium risk)**

1. `tests/components/chat/ChatMessage.test.tsx` - Test:
   - Renders user message
   - Renders agent message with correct styling
   - Renders markdown content
   - Renders code blocks with syntax highlighting

2. `tests/components/shared/ErrorBoundary.test.tsx` - Test:
   - Renders children when no error
   - Renders fallback on error
   - Calls onError callback
   - Recovery via key change

**Step 5: Run full test suite**

```bash
cd apps/web && pnpm test -- run --coverage
```
Target: meaningful coverage on critical paths. Don't chase percentage, focus on high-risk code.

**Step 6: Commit tests in batches**

```bash
git commit -m "test: add API route tests for chat, sync, and tasks"
git commit -m "test: add hook tests for useChat, useSyncStatus, useNotes"
git commit -m "test: add component tests for ChatMessage and ErrorBoundary"
```

---

### Task 11: Dead Code and Dependency Audit

**Files:**
- Potentially remove or document unused code
- Modify: `apps/web/package.json` if removing deps

**Step 1: Verify mathjs usage**

```bash
grep -r "mathjs\|math\.evaluate\|math\.parse" apps/web/src/ --include="*.ts" --include="*.tsx"
```
If no results, it's unused. Remove from package.json.

**Step 2: Verify colorthief usage**

```bash
grep -r "colorthief\|ColorThief\|getColor\|getPalette" apps/web/src/ --include="*.ts" --include="*.tsx"
```
If no results, it's unused. Remove from package.json.

**Step 3: Check for other unused imports across codebase**

```bash
pnpm turbo lint
```
With the enhanced ESLint from Task 1, `no-unused-vars` should flag dead imports.

**Step 4: Remove confirmed unused dependencies**

```bash
cd apps/web && pnpm remove <unused-package>
```

**Step 5: Run build to verify nothing breaks**

```bash
pnpm turbo typecheck && pnpm turbo build --filter=@q8/web && pnpm test -- run
```
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: remove unused dependencies after audit"
```

---

## Task Dependency Graph

```
Task 1 (ESLint) ──→ Task 2 (Fix any) ──→ Task 11 (Dead code audit)
       │
       └──→ Task 3 (ErrorBoundary)
       └──→ Task 4 (Security headers)
       └──→ Task 5 (Error responses) ──→ Task 6 (Hook errors)
       └──→ Task 7 (CalendarWidget refactor)
       └──→ Task 8 (FinanceHubWidget refactor)
       └──→ Task 9 (Chat component refactors)

All above ──→ Task 10 (Test coverage expansion)
```

Tasks 3, 4, 5, 7, 8, 9 can run in parallel after Task 1.
Task 10 should run last since it tests the refactored code.

---

## Quality Gates (run after ALL tasks complete)

```bash
pnpm turbo typecheck        # 0 errors
pnpm turbo lint             # 0 errors (with new strict rules)
pnpm turbo build --filter=@q8/web  # successful build
pnpm test -- run            # all tests pass
pnpm test -- run --coverage # review coverage report
```
