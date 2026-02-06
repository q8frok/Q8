# Agent Orchestration Enhancement Plan

**Date:** 2026-02-05
**Status:** Approved
**Approach:** Hybrid — `@openai/agents` SDK for core loop + custom router/tools
**Legacy:** Immediate replacement (no dual-path maintenance)

---

## Current State Summary

Two parallel orchestration systems exist:
- **Legacy** (`lib/agents/orchestration/`) — 15+ files, deeply integrated with Supabase, memory, context compression, speculative execution, response caching, quality scoring. Active default. Uses raw `openai` SDK.
- **SDK** (`lib/agents/sdk/`) — 12 files, cleaner but incomplete. Custom reimplementation of agent loop, tools, handoffs. Behind `USE_AGENTS_SDK` feature flag.

Neither uses the official `@openai/agents` npm package. Both use raw `openai` v4.28.0.

### Critical Issues
1. No real streaming — `stream: false` in runner, content delivered as single delta
2. No `@openai/agents` package — reimplements what the SDK provides natively
3. No conversation persistence in SDK path
4. Fragile hand-rolled `zodToJsonSchema()` converter
5. Handoffs re-route response text instead of using tool-call pattern
6. 4 agents have no functional tools (Secretary, Home, Finance, ImageGen)
7. Legacy wrapper uses deprecated `gpt-4o-mini` model
8. No abort/cancellation support

### What Works Well
- 3-tier router (explicit → keyword → LLM) — well-built, keep as-is
- Model factory with multi-provider fallback chains
- Error classification, retry logic, user-friendly messages
- Chat UI is 85-90% complete (36 components, 3 hooks, WebRTC voice, SSE event handling)
- 16 SSE event types fully supported by frontend

---

## Architecture Decision

### Keep (Custom)
- **Router** (`sdk/router.ts`) — 3-tier routing is cost-effective; `@openai/agents` doesn't provide routing
- **Tool definitions** (`sdk/tools/`) — Zod-validated implementations, convert to SDK function tools
- **Agent instructions** (`sdk/agents/index.ts`) — Become `@openai/agents` Agent instances
- **Model factory** (`model_factory.ts`) — Multi-provider fallback, wire into SDK model providers
- **Error utilities** (`sdk/utils/`) — Error classification, retry, user-friendly messages

### Replace with `@openai/agents`
- **Runner** (`sdk/runner.ts`) — Native streaming, tool loops, tracing
- **Handoffs** (`sdk/handoffs.ts`) — SDK's `handoff()` primitive (LLM invokes as tool call)
- **`zodToJsonSchema()`** — SDK handles Zod-to-JSON-Schema natively
- **SSE encoding** — SDK's event stream pipes to Response

### Delete (Legacy)
- `orchestration/service.ts` — Replaced by SDK runner
- `orchestration/agent-runner.ts` — Tool execution moves to SDK
- `orchestration/router.ts` — Replaced by `sdk/router.ts`
- `orchestration/handoff.ts` — Replaced by SDK handoffs
- `orchestration/constants.ts` — Wrapper prompt eliminated
- `api/chat/route.ts` — Non-streaming fallback removed
- Feature flag infrastructure — No longer needed

### Port from Legacy → SDK (move, don't duplicate)
- Memory extraction (`extractMemoriesAsync`)
- Document context (`getConversationContext`)
- Context compression (`maybeCompress`)
- Topic tracking (`getRoutingContext` / `updateTopicContext`)
- Response caching (`getResponseCache`)
- Quality scoring (`scoreResponse`)
- Conversation store (`addMessage`)
- Telemetry logging (`logRoutingTelemetry`)
- Widget action events
- Image generation/analysis event emission

---

## Phase 1: Foundation — `@openai/agents` + True Streaming

**Goal:** Replace hand-rolled agent loop with official SDK. Get token-level streaming working.

### 1.1 Install dependencies
- Add `@openai/agents` to package.json
- Zod v4 migration: install `zod@^4` (SDK requirement). Use `@zod/v3` compat layer for existing schemas during transition.
- Remove `USE_AGENTS_SDK` feature flag

### 1.2 Create model provider adapter
**New file:** `sdk/model-provider.ts`
- Adapter between `model_factory.ts` `ModelConfig` and `@openai/agents` model provider interface
- Supports OpenAI, Anthropic, Google, Perplexity, xAI providers
- Implements fallback chain logic from model factory
- Handles provider-specific quirks (xAI `max_tokens` vs `max_completion_tokens`)

### 1.3 Rewrite runner
**Modify:** `sdk/runner.ts`
- Replace `runAgent()` with `@openai/agents` `run(agent, input, { stream: true })`
- Map SDK streaming events to existing `OrchestrationEvent` types:
  - `raw_model_stream_event` → `content` (text deltas)
  - `run_item_stream_event` (tool calls) → `tool_start` / `tool_end`
  - `agent_updated_stream_event` → `handoff`
- Keep `StreamMessageOptions` interface unchanged
- Keep `AsyncGenerator<OrchestrationEvent>` return type
- Delete `zodToJsonSchema()`, `executeWithTimeout()`, `toOpenAITools()`
- Keep `executeTool()` for custom tool execution

### 1.4 Convert agent configs to SDK Agents
**Modify:** `sdk/agents/index.ts`
- Convert `agentConfigs` Record to `@openai/agents` `Agent` instances
- Wire handoffs using SDK's `handoff()` with `inputType` Zod schemas
- Convert `ToolDefinition` array to SDK function tools
- Set model via custom model provider from 1.2

### 1.5 Simplify handoffs
**Modify:** `sdk/handoffs.ts`
- Remove `decideHandoff()` and `executeHandoff()` (SDK handles this)
- Keep handoff context types (`CoderHandoffContext`, etc.)
- Keep `canHandoff()` validation (wire as handoff filter)
- Keep `formatHandoffMessage()` for UI display

### 1.6 Adapt tool definitions
**Modify:** `sdk/tools/default.ts`, `github.ts`, `spotify.ts`
- Convert `ToolDefinition` interface to be compatible with `@openai/agents` `tool()` function
- SDK handles Zod schema → JSON Schema conversion natively
- Keep execute functions unchanged

### 1.7 Update API route
**Modify:** `api/chat/stream/route.ts`
- Remove legacy import and feature flag
- Only use SDK `streamMessage`
- Pipe SDK events directly to SSE Response
- Add `AbortController` wired to request signal for cancellation

### 1.8 Delete legacy
**Delete files:**
- `api/chat/route.ts` (non-streaming fallback)
- `orchestration/service.ts`
- `orchestration/agent-runner.ts`
- `orchestration/router.ts`
- `orchestration/handoff.ts`
- `orchestration/constants.ts`

**Keep for Phase 2 porting:**
- `orchestration/context-builder.ts`
- `orchestration/context-compressor.ts`
- `orchestration/topic-tracker.ts`
- `orchestration/response-cache.ts`
- `orchestration/quality-scorer.ts`
- `orchestration/metrics.ts`
- `orchestration/speculative-executor.ts`
- `orchestration/types.ts` (event types shared with UI)

### 1.8b Update orchestration index
**Modify:** `orchestration/index.ts`
- Remove exports for deleted functions (`processMessage`, `streamMessage` from service)
- Keep type exports needed by UI and remaining modules

---

## Phase 2: Conversation Persistence & Context

**Goal:** Messages persist across sessions. Memory/RAG context flows into agents.

### 2.1 Add Supabase persistence to runner
**Modify:** `sdk/runner.ts`
- After routing: save user message to Supabase `chat_messages`
- After agent completes: save assistant message with agent_name
- On thread creation: create thread in Supabase `threads` table
- Retrieve conversation history from Supabase on thread resume
- Use `addMessage()` from `conversation-store.ts` for in-memory tracking

### 2.2 Integrate memory & document context
**Modify:** `sdk/runner.ts` (buildSystemPrompt enhancement)
- Port `fetchMemoryContext()` from `orchestration/context-builder.ts`
- Port `getConversationContext()` from `lib/documents/processor.ts`
- Inject memory + document context into agent system prompts
- Port `buildEnrichedContext()` for user profile enrichment

### 2.3 Port context compression
**Modify:** `sdk/runner.ts`
- Port `maybeCompress()` from `orchestration/context-compressor.ts`
- Apply to conversation history before passing to SDK agent
- Config: maxTokens=4000, recentMessageCount=8

### 2.4 Port topic tracking
**Modify:** `sdk/runner.ts`
- Port `getRoutingContext()` / `updateTopicContext()` from topic-tracker
- Wire into router for topic-aware routing

### 2.5 Port memory extraction
**Modify:** `sdk/runner.ts`
- Port `extractMemoriesAsync()` as fire-and-forget post-run hook
- Triggers after `done` event

### 2.6 Clean up ported modules
**Delete after porting:**
- `orchestration/context-builder.ts`
- `orchestration/context-compressor.ts`
- `orchestration/topic-tracker.ts`
- Move remaining orchestration types to `sdk/types.ts` or `orchestration/types.ts`

---

## Phase 3: Missing Tool Modules

**Goal:** Agents can actually perform their advertised tasks.

### 3.1 Google Workspace tools (Secretary agent)
**New file:** `sdk/tools/google.ts`
- Gmail: read inbox, search, send email, draft
- Calendar: list events, create/update/delete events, check conflicts
- Drive: search files, get file metadata
- Auth via Google OAuth tokens from user session

### 3.2 Home Assistant tools (Home agent)
**New file:** `sdk/tools/home.ts`
- Devices: list, get state, control (on/off, brightness, color)
- Climate: get/set thermostat, HVAC mode
- Scenes: activate scene
- Auth via HASS_TOKEN + HASS_URL env vars

### 3.3 Finance tools (Finance agent)
**Modify:** `sdk/tools/` — port from existing `lib/agents/tools/finance-tools.ts`
**New file:** `sdk/tools/finance.ts`
- Balance sheet, spending summary, cash flow
- Bill tracking, subscription audit
- Affordability analysis
- Port existing Zod schemas and executor logic

### 3.4 Image generation tools (ImageGen agent)
**New file:** `sdk/tools/image.ts`
- Generate image via OpenAI Images API (gpt-image-1.5)
- Edit/variation support
- Diagram/chart generation
- Image analysis via vision models
- Emit `image_generated` / `image_analyzed` events

### 3.5 Wire tools into agents
**Modify:** `sdk/agents/index.ts`
- Add Google tools to Secretary
- Add Home tools to Home
- Add Finance tools to Finance
- Add Image tools to ImageGen

**Modify:** `sdk/tools/index.ts`
- Export all new modules

---

## Phase 4: Polish & Advanced Features

**Goal:** Real-time human-like experience.

### 4.1 Eliminate orchestrator wrapper
- Remove the `wrapResponseAsOrchestrator()` pattern entirely
- Instead, enhance each agent's system prompt with Q8 personality guidelines
- This eliminates the extra LLM call that doubles response latency
- Personality agent already speaks as Q8; extend this to all agents

### 4.2 Response caching
**Modify:** `sdk/runner.ts`
- Port `getResponseCache()` / `isCacheable()` / `calculateTTL()`
- Cache high-quality responses for repeat queries
- Check cache before routing

### 4.3 Quality scoring
**Modify:** `sdk/runner.ts`
- Port `scoreResponse()` and `getFeedbackTracker()`
- Score responses post-completion
- Feed into caching decisions

### 4.4 Telemetry & tracing
**Modify:** `sdk/runner.ts`
- Port `logRoutingTelemetry()` from metrics module
- Enable `@openai/agents` built-in tracing
- Wire `sdk/utils/preflight.ts` for health checks

### 4.5 AbortController support
**Modify:** `sdk/runner.ts` + `api/chat/stream/route.ts`
- Pass request signal to SDK run options
- Cancel in-flight LLM calls when client disconnects

### 4.6 Final cleanup
**Delete remaining legacy files:**
- All remaining `orchestration/` files after porting
- `orchestration/` directory itself
- Update all imports across codebase

---

## Risk Mitigation

### Zod v4 Migration
- `@openai/agents` requires Zod v4
- Install `zod@^4` alongside `@zod/v3` compat layer
- Migrate tool schemas first (direct SDK integration)
- Migrate validation schemas incrementally
- Test each module after migration

### Frontend Stability
- `OrchestrationEvent` type contract stays identical
- SSE event format stays identical
- useChat hook processes same event types
- No frontend changes required in Phase 1-2

### Rollback Strategy
- Git branch per phase
- Each phase is independently deployable
- Phase 1 is the riskiest (most changes); test thoroughly before Phase 2

---

## File Change Summary

### Phase 1 (Foundation)
| Action | File | Reason |
|--------|------|--------|
| Modify | `package.json` | Add `@openai/agents`, upgrade Zod |
| Create | `sdk/model-provider.ts` | Adapter for multi-provider models |
| Rewrite | `sdk/runner.ts` | Use `@openai/agents` Agent + run() |
| Modify | `sdk/agents/index.ts` | Convert to SDK Agent instances |
| Simplify | `sdk/handoffs.ts` | Use SDK native handoffs |
| Modify | `sdk/tools/default.ts` | Adapt to SDK tool format |
| Modify | `sdk/tools/github.ts` | Adapt to SDK tool format |
| Modify | `sdk/tools/spotify.ts` | Adapt to SDK tool format |
| Modify | `api/chat/stream/route.ts` | Remove legacy, SDK-only |
| Modify | `orchestration/index.ts` | Remove deleted exports |
| Delete | `api/chat/route.ts` | Non-streaming fallback |
| Delete | `orchestration/service.ts` | Replaced by SDK |
| Delete | `orchestration/agent-runner.ts` | Replaced by SDK |
| Delete | `orchestration/router.ts` | Replaced by SDK router |
| Delete | `orchestration/handoff.ts` | Replaced by SDK handoffs |
| Delete | `orchestration/constants.ts` | Wrapper prompt eliminated |

### Phase 2 (Persistence)
| Action | File | Reason |
|--------|------|--------|
| Modify | `sdk/runner.ts` | Add persistence, memory, compression |
| Delete | `orchestration/context-builder.ts` | Ported to SDK |
| Delete | `orchestration/context-compressor.ts` | Ported to SDK |
| Delete | `orchestration/topic-tracker.ts` | Ported to SDK |

### Phase 3 (Tools)
| Action | File | Reason |
|--------|------|--------|
| Create | `sdk/tools/google.ts` | Secretary agent tools |
| Create | `sdk/tools/home.ts` | Home agent tools |
| Create | `sdk/tools/finance.ts` | Finance agent tools |
| Create | `sdk/tools/image.ts` | ImageGen agent tools |
| Modify | `sdk/agents/index.ts` | Wire new tools |
| Modify | `sdk/tools/index.ts` | Export new modules |

### Phase 4 (Polish)
| Action | File | Reason |
|--------|------|--------|
| Modify | `sdk/runner.ts` | Caching, scoring, tracing, abort |
| Modify | `sdk/agents/index.ts` | Enhanced Q8 personality in prompts |
| Modify | `api/chat/stream/route.ts` | AbortController |
| Delete | Remaining `orchestration/` | Final cleanup |

---

## Success Criteria

1. **Token-level streaming** — First token appears within 1-2s of user sending message
2. **Conversation persistence** — Messages survive page reload, thread switching
3. **Functional agents** — All 8 agents can perform their advertised tasks with real tools
4. **Handoffs work natively** — LLM can request handoffs mid-conversation via tool calls
5. **No latency regression** — Eliminating wrapper pass should improve TTFT
6. **Frontend unchanged** — Same SSE event types, same hook callbacks, zero UI breakage
7. **Type safety** — Zero `any` types, all schemas validated
8. **Build passes** — `pnpm turbo typecheck` and `pnpm turbo build` succeed
