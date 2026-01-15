# Q8 AI Enhancement Plan

## Goals

- Optimize for task success first, latency second, cost third.
- Use adaptive routing based on recent performance metrics and model judgment.
- Sync all memories to Supabase (no local-only memory).
- Make tool visibility user-toggleable by default.
- Add Finance Advisor to core routing.

## Phase 1 — Unified Orchestration Core

**Objective:** One orchestration path for streaming and non-streaming flows.

- Consolidate routing + tool orchestration into a shared service used by both `processMessage` and `/api/chat/stream`.
- Replace keyword routing with LLM router + heuristic fallback.
- Add Finance Advisor to routing and tool registration.
- Ensure streaming path uses the same agent configs and tool schemas.

## Phase 2 — Adaptive Router + Policy Engine

**Objective:** Adaptive routing that prioritizes task success.

- Introduce a routing policy engine with per-agent performance metrics.
- Router returns structured output: `{ agent, confidence, rationale, fallbackAgent, toolPlan }`.
- Policy weighting: task success > latency > cost.
- Include implicit feedback signals (retries, manual agent selection, tool failures).

## Phase 3 — Memory 2.0 + High-Precision RAG

**Objective:** Supabase-first memory with precision-focused retrieval.

- Supabase becomes the source of truth for all memories.
- Implement hybrid retrieval (pgvector + exact/keyword matching).
- Add memory recency/importance decay and conflict resolution.
- Provide provenance in responses (“why this memory”).

## Phase 4 — Output UX + Tool Visibility

**Objective:** Tool trace visibility is user-controlled and cleanly presented.

- Add user preference for tool visibility; default to user-toggleable.
- Render tool result cards only when enabled.
- Add agent segment markers in streaming UI.
- Add inline citations for research responses.

## Phase 5 — Observability + Evals

**Objective:** Prove routing success and memory relevance with measurable metrics.

- Add telemetry for routing decisions, model selection, tool outcomes.
- Add an eval harness and regression suite.
- Track success metrics by agent and feed back into adaptive routing.

## Proposed Eval Suite

### Routing Accuracy (50 prompts)

- 10 coding
- 10 research
- 10 productivity
- 10 finance
- 10 home automation

### Memory Precision (30 prompts)

- 10 preference recall
- 10 task follow-ups
- 10 factual profile recall

### Tool Appropriateness (20 prompts)

- 10 requiring tools
- 10 where tool use is incorrect

### Scoring

- Primary: task success rate
- Secondary: latency (p95)
- Tertiary: cost per request
- Quality: memory precision@5 and hallucination rate
