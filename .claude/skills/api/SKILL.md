# /api — Next.js API Route & Server Action Conventions

Patterns for creating API routes and Server Actions in Q8.

## Auto-Invocation
This skill activates automatically when creating API routes or Server Actions.

## API Route Template (Route Handlers)

```typescript
// apps/web/src/app/api/<resource>/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('<table>')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## Server Action Template

```typescript
// apps/web/src/app/actions/<resource>.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/db/supabase-server';

export async function create<Resource>(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('<table>')
    .insert({ /* fields */ });

  if (error) throw new Error(error.message);

  revalidatePath('/<path>');
}
```

## Rules
- API routes go in `apps/web/src/app/api/` using the App Router convention.
- Server Actions go in `apps/web/src/app/actions/` with `'use server'` directive.
- Always validate input at the API boundary (Zod preferred).
- Use Supabase server client for auth-protected operations.
- Return proper HTTP status codes (400 for validation, 401 for auth, 500 for server errors).
- Remember: UI reads from RxDB, not from API routes directly. API routes are for sync and external integrations.
- No `any` types.
