# Chat History Conflict Resolution (Deterministic Retry/Reconnect)

This document defines how chat history is assembled for `/api/chat/stream` so retries and reconnects remain deterministic when local UI state and server state diverge.

## Canonical Source of Truth

- Canonical thread history is always fetched server-side from persisted `chat_messages` rows, ordered by `created_at ASC`.
- Client-provided `conversationHistory` is not used for production streaming.
- The client sends only:
  - `message` (new user intent)
  - `threadId` (conversation identity)
  - optional user UX hints (e.g. `userProfile`)

## Conflict Resolution Rules

When local unsynced messages exist (e.g. due to network drop, tab refresh, or retry):

1. **Server history wins for prior turns**
   - Only persisted thread messages are used as prior context.
   - Local-only messages are treated as optimistic UI artifacts, not canonical context.

2. **Current request intent is explicit and singular**
   - The posted `message` is appended as the active turn regardless of local cache state.
   - This avoids replaying duplicated local messages from stale browser buffers.

3. **No implicit merge of client transcript**
   - The backend does not merge client-side transcript snapshots with canonical history.
   - This prevents nondeterministic ordering across retries/reconnects.

4. **Idempotent retry behavior**
   - A retry resubmits only the explicit user message for the same `threadId`.
   - Prior context remains stable because it is always rebuilt from storage.

## Internal Override (Non-Production)

The SDK runner still allows a prebuilt history override for tests/internal tooling.

- `historyOverride` is optional and internal-use only.
- Default production path is server-assembled canonical history.
