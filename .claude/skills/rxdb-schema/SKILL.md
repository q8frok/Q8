# /rxdb-schema — RxDB Schema Creator

Create RxDB schemas that align with Supabase tables for Q8's local-first architecture.

## Auto-Invocation
This skill activates automatically when creating or modifying RxDB collections.

## Template

```typescript
import { RxJsonSchema } from 'rxdb';

export const <name>Schema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    // ... fields matching Supabase table columns
  },
  required: ['id', 'created_at', 'updated_at'],
  indexes: ['updated_at']
};
```

## Rules
- Schema field names must match Supabase column names exactly (snake_case).
- `id` is always the primaryKey (UUID string, maxLength 36).
- Always include `created_at` and `updated_at` timestamps.
- Add `updated_at` to indexes for replication checkpoint queries.
- Place schemas in `apps/web/src/lib/db/` or `packages/db-schema/`.
- No `any` in the generic — define a proper TypeScript interface.
- Keep schemas in sync: RxDB schema ↔ Supabase migration ↔ TypeScript type.
- Use `version: 0` for new schemas; increment when migrating existing ones.
