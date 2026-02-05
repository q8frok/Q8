# /component — React Component Creator

Create React components following Q8's glass design system conventions.

## Invocation
- **Manual:** `/component <ComponentName>` — create a new component
- **Auto:** Triggered when creating new React components

## Template

Components must follow this structure:

```tsx
'use client';

import { cn } from '@/lib/utils';

interface <Name>Props {
  className?: string;
  // ... specific props
}

export function <Name>({ className, ...props }: <Name>Props) {
  return (
    <div className={cn(
      // Glass base
      'backdrop-blur-[24px] bg-white/[0.04] border border-white/[0.06]',
      'rounded-2xl shadow-lg',
      className
    )}>
      {/* content */}
    </div>
  );
}
```

## Rules
- Always use `'use client'` directive for interactive components.
- Use the `cn()` utility from `@/lib/utils` for className merging.
- Apply glassmorphism styling: `backdrop-blur-[24px]`, `bg-white/[0.04]`, `border-white/[0.06]`.
- Export as named function (not default export).
- Place in `apps/web/src/components/` in the appropriate subdirectory:
  - `ui/` — Shadcn primitives and base components
  - `dashboard/` — Bento grid widgets and dashboard panels
  - `voice/` — Voice interface components
  - `shared/` — Cross-cutting components (AI buttons, etc.)
- Use `lucide-react` for icons.
- Use `framer-motion` for animations.
- Props interface must include optional `className`.
- No `any` types — strict TypeScript.
