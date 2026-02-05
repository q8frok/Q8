# Testing Guide

## Framework

Q8 uses **Vitest** with **happy-dom** for unit and component testing.

- **Test runner:** Vitest 1.2+
- **DOM environment:** happy-dom
- **Component testing:** @testing-library/react
- **E2E testing:** Playwright (for UI/Auth/Navigation changes)

## File Locations

Tests live in `apps/web/tests/` (NOT `src/__tests__/`).

```
apps/web/tests/
├── setup.ts                          # Global test setup
├── api/                              # API route tests
│   └── chat.test.ts
├── components/                       # Component tests
│   ├── ChatMessage.test.tsx
│   └── ErrorBoundary.test.tsx
├── hooks/                            # Hook tests
│   └── useTasksEnhanced.test.ts
├── lib/                              # Library/utility tests
│   ├── agents/
│   │   ├── model_factory.test.ts
│   │   └── orchestration/
│   │       └── router.test.ts
│   ├── sync/
│   │   └── engine.test.ts
│   └── ...
└── ...
```

## Test Setup

Global setup is in `apps/web/tests/setup.ts`. It:

- Imports `@testing-library/jest-dom` for DOM matchers
- Stubs environment variables (Supabase URL, API keys)
- Mocks `global.fetch`
- Mocks `ResizeObserver`, `IntersectionObserver`, `matchMedia`
- Clears all mocks between tests via `beforeEach`

## Import Pattern

Vitest globals are enabled (no need to import `describe`/`it`/`expect` at runtime), but **TypeScript doesn't know about globals**. You must import from `vitest` for type safety:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

This is required in every test file to avoid TypeScript errors.

## Running Tests

```bash
# Run all tests
pnpm test -- run

# Run a single test file
pnpm test -- apps/web/tests/hooks/useTasksEnhanced.test.ts

# Watch mode (re-runs on file changes)
pnpm test -- --watch

# Run with coverage
pnpm test -- run --coverage
```

## Mock Patterns

### Framer Motion

Framer Motion is mocked in tests as simple div wrappers to avoid animation-related issues:

```typescript
vi.mock('framer-motion', () => ({
  motion: {
    div: (props: Record<string, unknown>) => {
      const { children, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    // ... other elements
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

### API Authentication

Mock `getAuthenticatedUser` from `@/lib/auth/api-auth`:

```typescript
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
  }),
}));
```

### RxDB

Mock RxDB hooks for component tests:

```typescript
vi.mock('rxdb-hooks', () => ({
  useRxData: vi.fn().mockReturnValue({
    result: [],
    isFetching: false,
  }),
  useRxDB: vi.fn().mockReturnValue({
    // mock database instance
  }),
}));
```

### Next.js Router

```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue('/'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));
```

### LLM Responses

Always mock LLM responses in tests. Never burn API credits on unit tests:

```typescript
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'mocked response' } }],
        }),
      },
    },
  })),
}));
```

## Known Issues

There are ~20 pre-existing test failures across:

- **model_factory tests** - `user_id` mismatch in mock data
- **routing tests** - `user_id` mismatch in mock data
- **sync engine tests** - `user_id` mismatch in mock data

These are tracked and do not block development of new features. New tests should pass independently.

## Writing New Tests

### Naming Convention

- Test files: `*.test.ts` or `*.test.tsx`
- Place in the corresponding subdirectory under `apps/web/tests/`
- Mirror the source file structure (e.g., `src/hooks/useChat.ts` → `tests/hooks/useChat.test.ts`)

### Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies first
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### What to Test

- **API routes:** Request/response handling, authentication, error cases
- **Hooks:** State changes, side effects, error states
- **Components:** Rendering, user interactions, conditional display
- **Agents:** Model routing, tool execution, fallback behavior
- **Sync:** Push/pull logic, conflict resolution

### What NOT to Test

- Shadcn/ui primitives (tested upstream)
- Tailwind class names
- Third-party library internals
- Exact animation values

## See Also

- [Constitution & Protocols](./constitution-and-protocols.md) - Quality gates and development rules
- [Backend Development Plan](./backend-development-plan.md) - Agent testing patterns
