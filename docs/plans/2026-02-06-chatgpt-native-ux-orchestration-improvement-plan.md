# Q8 AI Orchestration + Tooling Audit and ChatGPT-Like UX Improvement Plan

**Date:** 2026-02-06  
**Status:** Proposed  
**Author:** Codex (analysis from current source)

---

## 1) Executive summary

Q8 already has a strong foundation for a ChatGPT-like assistant experience:

- Real streaming pipeline (`@openai/agents` runner + SSE + incremental UI rendering).
- Multi-agent routing and handoffs.
- Rich event model (routing, handoff, tool start/end, citations, memory, image events).
- Threaded chat UX with voice and tool execution visibility.

However, the current experience is **not yet fully “native ChatGPT-like”** because key gaps remain in state, reliability, and orchestration consistency:

1. The API route still supports a legacy orchestration fallback path (`USE_LEGACY_ORCHESTRATION`) and mixed code paths.
2. Runner thread IDs are generated in-memory but not strongly bound to persistent orchestration state in the SDK path itself.
3. Tooling architecture is split between direct SDK tools and MCP tooling elsewhere, causing conceptual duplication.
4. Abort/cancellation is only partially wired (AbortController is created in runner, but request signal propagation and cancellation semantics are incomplete end-to-end).
5. Chat UX lacks several ChatGPT-grade details: richer run timeline controls, reliable run replay/debug views, deterministic message status model, and tighter thread lifecycle semantics.

This plan proposes a phased migration to a **single orchestration core** with deterministic eventing, unified tool registry, and a polished ChatGPT-like interaction model over your existing UI + data model.

---

## 2) Current-state analysis from source

## 2.1 Orchestration topology

### API entrypoint
- `/api/chat/stream` uses SSE and maps orchestration events to UI events.
- It still supports toggling between SDK and legacy orchestration via `USE_LEGACY_ORCHESTRATION` and request-level override.

### SDK runner
- `streamMessage()` in SDK runner uses `run()` from `@openai/agents` with streaming.
- Maps `raw_model_stream_event`, `run_item_stream_event`, and `agent_updated_stream_event` into project event types.
- Builds input from client-provided conversation history when available.

### Routing
- A 3-tier routing strategy exists in SDK router:
  1) explicit mention
  2) keyword routing
  3) LLM routing with structured output schema

### Agent definitions + tools
- Agents are declared with `Agent` + `handoff` and include built-in hosted tools plus custom tools.
- SDK tool barrel notes “direct API tools without MCP proxy layer”.

### Chat state pipeline
- `useChat` builds conversation history client-side and sends it with each request.
- Stream events are parsed and folded into local message state (tool events, citations, images, handoffs, done/error).
- Existing thread load and message persistence are done via `/api/threads/*` endpoints.

---

## 2.2 Strengths

1. **End-to-end streaming already works** from SDK runner through SSE to UI token rendering.
2. **Comprehensive event protocol** supports advanced UX (tools, handoff, citations, image outputs, widget actions).
3. **Thread-aware UI** is already present with sidebar, thread switching, and rehydration of existing messages.
4. **Multi-modal intent** is present (text, voice, ambient mode).
5. **Agent specialization model** is already mapped and user-visible.

---

## 2.3 Gaps and risk areas

### A) Dual orchestration paths
- Keeping legacy + SDK in runtime path increases inconsistency risk and debugging complexity.

### B) Conversation authority is fragmented
- Client composes `conversationHistory` from local state, while persisted thread history exists server-side.
- This can cause subtle divergence under retries, reconnects, or multi-device usage.

### C) Tooling architecture split
- SDK tools are direct API, while repo also contains MCP stack and tool modules elsewhere.
- Creates maintenance overhead and unclear “source of truth” for tool contracts.

### D) Cancellation semantics incomplete
- Client can abort fetch; runner creates AbortController, but cancellation is not clearly wired from request signal to model run lifecycle across all paths.

### E) ChatGPT-like run UX not fully surfaced
- Tool executions are shown, but timeline-grade “run state machine” and deterministic statuses are limited.
- No explicit “queued/running/requires_tool/completed/failed/cancelled” interaction model in UI.

---

## 3) Web reference baseline for correct OpenAI workflow

> Note: external web fetch from this execution environment is proxy-restricted (HTTP CONNECT 403), so the links below are canonical references to validate against in a normal network-enabled environment.

Use these official references as source-of-truth for implementation details:

1. **OpenAI Agents SDK JS – Running agents**  
   https://openai.github.io/openai-agents-js/guides/running-agents/
2. **OpenAI Agents SDK JS – Tools**  
   https://openai.github.io/openai-agents-js/guides/tools/
3. **OpenAI Agents SDK JS – Handoffs**  
   https://openai.github.io/openai-agents-js/guides/handoffs/
4. **OpenAI Platform – Tools (Responses API mode)**  
   https://platform.openai.com/docs/guides/tools?api-mode=responses
5. **OpenAI Platform – Conversation state (Responses API mode)**  
   https://platform.openai.com/docs/guides/conversation-state?api-mode=responses
6. **OpenAI Platform – Agents guide**  
   https://platform.openai.com/docs/guides/agents

Practical alignment targets from these docs:
- Single run loop with robust streaming event handling.
- Strong tool schemas and deterministic tool call lifecycle.
- First-class handoffs (no ad hoc prompt-based delegation hacks).
- Explicit conversation state authority and resumability.
- Cancellation/timeout observability and error boundaries.

---

## 4) Target state: “Native ChatGPT-like” UX on Q8 data + UI

Design principle: **keep your existing UI language and data platform, but upgrade runtime semantics to ChatGPT-grade reliability and clarity.**

### 4.1 Runtime model

- One authoritative orchestration path (SDK-only).
- One authoritative conversation state source per thread (server-backed thread history, client as reactive cache).
- One unified tool registry with clear capability metadata and guardrails.
- One deterministic run state machine exposed to UI.

### 4.2 UX model

For every user send:
1. Message enters “queued”.
2. Route decision appears quickly with confidence/source.
3. Assistant run becomes “running”.
4. Tool calls stream as timeline items (start/end, result summary, duration).
5. Handoffs appear as structured transitions.
6. Content streams progressively.
7. Final run state is committed with replayable metadata.

This gives the user the same trust and clarity pattern as ChatGPT’s native experience while preserving Q8’s specialized agent flavor.

---

## 5) Comprehensive improvement plan

## Phase 0 — Observability + baseline hardening (1 week)

- Add run IDs and correlation IDs across API route, runner, tool calls, and UI events.
- Emit deterministic metrics for: routing latency, first token latency, tool latency, handoff count, total completion time, cancellation rate.
- Add log redaction + structured error classes for tool failures.

**Deliverable:** stable telemetry foundation for every chat run.

## Phase 1 — Orchestration unification (1–2 weeks)

- Remove runtime legacy fallback from `/api/chat/stream` and use SDK-only path.
- Propagate request abort signal into runner run lifecycle.
- Define canonical event contract (versioned) and enforce with schema validation at API boundary.

**Deliverable:** one reliable orchestration engine with cancel-safe streaming.

## Phase 2 — Conversation state authority (1–2 weeks)

- Move history assembly to server using thread as source-of-truth.
- Client sends only latest user message + thread ID + optional UX hints.
- Add idempotency keys for send/retry to prevent duplicate assistant messages.
- Ensure thread creation/first message commit is atomic.

**Deliverable:** deterministic thread continuity across refreshes/devices.

## Phase 3 — Unified tools platform (2 weeks)

- Create a single registry interface for all tools (SDK direct, MCP-backed, hosted).
- Every tool declares: schema, auth requirements, timeout, retry policy, safety policy, redaction rules, user-visible description.
- Standardize tool result envelope (`success`, `data`, `display`, `error`, `retryable`).

**Deliverable:** consistent tool behavior and predictable UI rendering.

## Phase 4 — ChatGPT-grade run UX (2 weeks)

- Add run timeline rail in chat message card:
  - routing
  - handoffs
  - tool calls
  - citations/memory/image events
  - completion metadata
- Introduce explicit run statuses in UI state:
  - `queued | running | awaiting_tool | completed | failed | cancelled`
- Add stop/regenerate/continue controls with deterministic behavior.
- Add optimistic assistant placeholder transitions and reconnection-safe stream resume UX.

**Deliverable:** transparent, polished, native-feeling conversational workflow.

## Phase 5 — Personalization + quality layer (ongoing)

- Preference memory policies (tone, verbosity, output format) applied consistently at run start.
- Quality scoring hooks to trigger auto-repair (re-run with stronger model, invoke secondary agent, etc.).
- Proactive assistant capabilities tied to thread context and user consent.

**Deliverable:** higher answer quality and consistent assistant personality.

---

## 6) Data and contract changes required

1. **Run entity**: persist run metadata per assistant turn (run_id, status, timings, selected_agent, handoffs, tool summaries, error class).
2. **Message entity**: add stable linkage to run_id and finalization state.
3. **Tool execution entity**: normalize start/end timestamps, outcome, latency, and redacted debug payload.
4. **Event schema versioning**: include `event_version` to allow non-breaking UI evolution.

---

## 7) Proposed UX deltas to match ChatGPT interaction quality

- Sticky composer with robust keyboard-first interactions and deterministic submit/cancel behavior.
- Better conversation resume indicators (“Reconnected”, “Run resumed”, “Last completed at…”).
- Configurable “thinking visibility” modes:
  - minimal (just answer)
  - normal (tools + handoffs summary)
  - debug (full timeline)
- Integrated source/citation drawer for research-heavy outputs.
- Strong empty/error states with actionable remediation.

---

## 8) Validation checklist

### Functional
- Streaming starts < 1.2s p95 after submit.
- Cancellation halts token flow and marks run `cancelled`.
- Retry on transient tool failure recovers without duplicate user-visible output.
- Multi-agent handoff chain is represented accurately in UI timeline.

### Reliability
- No duplicate assistant messages on refresh/reconnect.
- Thread replay reproduces same ordered event timeline.
- Tool errors map to user-safe messages + structured telemetry.

### UX
- Users can always tell: what agent is active, what tools are running, and whether the response is still in progress.

---

## 9) Immediate next actions (recommended)

1. Implement Phase 0 + Phase 1 first (unification + observability + cancellation).
2. Run a 1-week shadow benchmark on production-like traffic with run-level telemetry.
3. Then begin Phase 2 (server-authoritative conversation state), which unlocks the cleanest ChatGPT-like UX behavior.

---

## 10) Source files reviewed for this analysis

- `apps/web/src/app/api/chat/stream/route.ts`
- `apps/web/src/lib/agents/sdk/runner.ts`
- `apps/web/src/lib/agents/sdk/router.ts`
- `apps/web/src/lib/agents/sdk/agents/index.ts`
- `apps/web/src/lib/agents/sdk/tools/index.ts`
- `apps/web/src/hooks/useChat.ts`
- `apps/web/src/hooks/useUnifiedChat.ts`
- `apps/web/src/components/chat/UnifiedConversation.tsx`
- `apps/web/src/components/chat/UnifiedChatWithThreads.tsx`
- `docs/plans/2026-02-05-agent-orchestration-design.md`

