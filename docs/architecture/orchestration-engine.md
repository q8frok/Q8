# Orchestration Engine

## Overview

The orchestration engine is the intelligent middleware that powers Q8's multi-agent routing and execution. Located in `apps/web/src/lib/agents/orchestration/`, it consists of 19 modules that handle everything from intent classification to response caching.

## Pipeline

```
User Message
     ↓
Vibe Check (sentiment/energy analysis)
     ↓
Topic Tracker (detect topic switches)
     ↓
Router (LLM + heuristic + vector routing)
     ↓
Context Builder (memories, conversation, device state)
     ↓
Context Compressor (reduce token usage)
     ↓
Agent Runner (execute with tools, timeout management)
     ↓
Quality Scorer (evaluate response quality)
     ↓
Response Cache (store for future similarity matches)
     ↓
Response → User
```

## Modules

### Router (`router.ts`)

LLM-based intelligent router that selects agents based on task requirements and performance metrics. Uses `AGENT_CAPABILITIES` definitions to match user intent to the right specialist.

**Routing strategies:**
- `heuristicRoute()` - Fast keyword-based classification (fallback)
- `llmRoute()` - GPT-5.2 powered intent classification (primary)
- Combined approach: LLM first, heuristic fallback for speed

### Vector Router (`vector-router.ts`)

Semantic vector routing using embedding similarity search against training examples. Supports continuous feedback learning.

**Key functions:**
- `vectorRoute()` - Route by semantic similarity to past examples
- `hybridRoute()` - Combine vector + heuristic + LLM routing
- `submitRoutingFeedback()` - Learn from routing outcomes
- `addRoutingExample()` - Add new training examples
- `seedExampleEmbeddings()` - Initialize with seed data
- `getRoutingStats()` - View routing performance

### Speculative Router (`speculative-router.ts`)

For ambiguous requests, queries multiple agents in parallel and returns the best response based on quality scoring. Trades compute cost for better response quality on uncertain classifications.

### Speculative Executor (`speculative-executor.ts`)

Pre-fetches likely data in the background while the LLM generates its response. Reduces perceived latency by having tool results ready before the agent asks for them.

### Context Builder (`context-builder.ts`)

Fetches and aggregates multiple context sources to build rich agent prompts:
- User memories and preferences
- Conversation history
- Device state (for Home Agent)
- Time and location context

### Context Compressor (`context-compressor.ts`)

Intelligently compresses long conversation history to reduce token usage:
- Summarizes older messages
- Extracts key facts
- Preserves recent context verbatim
- Adapts compression ratio to model context limits

### Handoff (`handoff.ts`)

Manages agent transfers while preserving context:
- Explicit handoffs (user requests specific agent)
- Implicit handoffs (router detects domain change)
- Context preservation across transfers
- Handoff history tracking

### Agent Runner (`agent-runner.ts`)

Maps agent types to their available tools and executes tool calls:
- Tool discovery and binding per agent
- Timeout management per tool
- Error handling and retry logic
- Streaming support

### Quality Scorer (`quality-scorer.ts`)

Multi-dimensional response quality assessment:
- Relevance to original query
- Completeness of response
- Accuracy indicators
- Implicit feedback detection (user re-asks, complaints)
- Scores feed back into routing decisions

### Response Cache (`response-cache.ts`)

Caches responses with semantic similarity matching:
- Exact match cache (hash-based)
- Semantic similarity cache (embedding-based)
- TTL-based expiration
- Cache invalidation on context changes

### Vibe Check (`vibe-check.ts`)

Analyzes user sentiment, energy level, and emotions from recent messages:
- Sentiment analysis (positive/negative/neutral)
- Energy level detection (urgent, casual, frustrated)
- Adjusts agent tone dynamically
- Influences routing (e.g., frustrated user → more capable model)

### Topic Tracker (`topic-tracker.ts`)

Tracks conversation topics and detects topic switches:
- Maintains topic stack
- Detects domain changes (code → email → chat)
- Informs routing on topic continuity
- Provides `RoutingContext` to router

### Proactive Suggestions (`proactive-suggestions.ts`)

Generates context-aware action suggestions:
- Time-based suggestions (morning briefing, end-of-day summary)
- Context-based suggestions (PR ready for review, calendar conflict)
- User habit-based suggestions

### User Context (`user-context.ts`)

Unified user context service (the "Memex"):
- Stores user preferences and habits
- Tracks relationships and frequently mentioned entities
- Provides context enrichment for all agents

### Metrics (`metrics.ts`)

Tracks agent performance for adaptive routing:
- Success rates per agent
- Latency percentiles
- Failure modes and counts
- Cost tracking per request
- Data feeds into router's model selection

### Constants (`constants.ts`)

Defines per-tool timeout configurations and agent system prompts.

### Types (`types.ts`)

Shared TypeScript types:
- `ExtendedAgentType` - All agent type identifiers
- `RoutingDecision` - Router output with confidence scores
- `OrchestrationRequest` / `OrchestrationResponse` - Pipeline I/O
- `OrchestrationEvent` - Event stream types
- `AgentCapability` - Agent capability definitions
- `RoutingPolicy` - Configurable routing behavior

### Service (`service.ts`)

Unified orchestration service entry point:
- `orchestrate()` - Non-streaming chat flow
- `orchestrateStream()` - Streaming chat flow
- Ties all modules together into the complete pipeline

### Index (`index.ts`)

Barrel export file. Re-exports all public types and functions from the orchestration module.

## File Map

```
apps/web/src/lib/agents/orchestration/
├── index.ts                 # Barrel exports
├── types.ts                 # Shared types
├── constants.ts             # Timeouts, system prompts
├── service.ts               # Unified entry point
├── router.ts                # LLM + heuristic routing
├── vector-router.ts         # Semantic vector routing
├── speculative-router.ts    # Parallel agent execution
├── speculative-executor.ts  # Predictive data prefetch
├── context-builder.ts       # Multi-source context assembly
├── context-compressor.ts    # Token-efficient compression
├── handoff.ts               # Agent transfer protocol
├── agent-runner.ts          # Tool execution engine
├── quality-scorer.ts        # Response quality assessment
├── response-cache.ts        # Semantic response caching
├── vibe-check.ts            # Sentiment/energy analysis
├── topic-tracker.ts         # Conversation topic tracking
├── proactive-suggestions.ts # Anticipatory suggestions
├── user-context.ts          # User memory ("Memex")
└── metrics.ts               # Performance tracking
```

## See Also

- [Agent Swarm Architecture](./agent-swarm.md) - Agent definitions and routing logic
- [System Architecture](./system-architecture.md) - Overall system design
