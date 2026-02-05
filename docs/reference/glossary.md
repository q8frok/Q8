# Q8 Glossary

## Terms and Definitions

### A

**Agent**
An AI model with specific instructions, tools, and capabilities. Q8 uses multiple specialized agents.

**Agent Swarm**
The collection of specialized AI agents working together under orchestrator coordination.

**App Router**
Next.js 13+ routing system using the `app/` directory with React Server Components.

### B

**Bento Grid**
A responsive grid layout system for the Q8 dashboard, inspired by Apple's macOS widgets.

### C

**Claude Opus 4.5**
Anthropic's AI model used as the Dev Agent for coding tasks. Model ID: `claude-opus-4-5-20251101`.

**Context Compression**
Technique for reducing token usage by summarizing older conversation messages while preserving recent context verbatim. Implemented in `orchestration/context-compressor.ts`.

**Context Window**
The amount of text (tokens) an AI model can process at once.

### D

**Dev Agent**
Specialist agent powered by Claude Opus 4.5, handles coding and GitHub operations.

### E

**Edge Functions**
Serverless functions that run on edge networks close to users for low latency.

### G

**Gemini 3 Flash**
Google's AI model used as the Secretary Agent and Finance Agent.

**Glassmorphism**
UI design style using frosted glass effects, transparency, and blur.

**GPT-5.2**
OpenAI's model used as the Orchestrator for routing and reasoning.

**GPT-5-mini**
OpenAI's smaller model used as the Home Agent and as a fallback for other agents.

**Grok 4.1 Fast**
xAI's model used as the Personality Agent for creative and casual interactions.

### H

**Handoff**
The process of transferring a task from one agent to another. Managed by `orchestration/handoff.ts`.

**HNSW**
Hierarchical Navigable Small World - algorithm for efficient vector similarity search.

### I

**IndexedDB**
Browser database used by RxDB for local-first data storage.

### L

**LiteLLM**
Library for routing requests to different AI providers using a unified interface.

**Local-First**
Architecture where data is stored locally first, then synced to the cloud.

### M

**MCP (Model Context Protocol)**
Standard protocol for exposing tools and capabilities to AI models.

**MCP Server**
Microservice that implements MCP protocol to provide tools (e.g., GitHub integration).

### O

**Orchestration Engine**
The 19-module middleware in `lib/agents/orchestration/` that handles routing, context building, execution, quality scoring, and caching. See [orchestration-engine.md](../../docs/architecture/orchestration-engine.md).

**Orchestrator**
Main agent (GPT-5.2) that routes user requests to specialist sub-agents.

**Optimistic UI**
UI updates immediately before server confirmation, assuming success.

**OPFS**
Origin Private File System - fast file system API in browsers.

### P

**Perplexity Sonar Pro**
AI model specialized in web search, used as the Research Agent.

**pgvector**
PostgreSQL extension for vector similarity search, used for RAG.

**PWA**
Progressive Web App - web app with native-like features.

### R

**RAG (Retrieval-Augmented Generation)**
AI technique using vector search to find relevant information before generating responses.

**Realtime**
Supabase feature for live database subscriptions and updates.

**RLS (Row Level Security)**
PostgreSQL feature enforcing data access rules at the database level.

**RSC (React Server Components)**
React components that render on the server, reducing client JavaScript.

**RxDB**
Reactive database for JavaScript, built on IndexedDB.

### S

**Secretary Agent**
Specialist agent powered by Gemini 3 Flash for productivity tasks (email, calendar, docs).

**Server Actions**
React 19 feature for running server-side code from client components.

**Speculative Execution**
Technique where the system pre-fetches likely data or queries multiple agents in parallel for ambiguous requests, reducing perceived latency. Implemented in `orchestration/speculative-executor.ts` and `speculative-router.ts`.

**SSR (Server-Side Rendering)**
Rendering React components on the server for faster initial load.

**Supabase**
Backend-as-a-Service providing PostgreSQL, Auth, Storage, and Realtime.

**Sub-Agent**
Specialist agent that handles specific domains (coding, research, productivity, finance, home, etc.).

### T

**Turbo**
Vercel's monorepo build system for managing multiple packages.

### V

**Vector Embedding**
Numerical representation of text for semantic similarity search.

**Vector Search**
Finding similar items using vector embeddings and distance calculations.

**Vibe Check**
Sentiment and energy analysis of user messages, used to adjust agent tone dynamically. Implemented in `orchestration/vibe-check.ts`.

### W

**WebRTC**
Real-time communication protocol for voice/video, used for Q8's voice interface.

## Agent Types

- **Orchestrator:** GPT-5.2 - Main router
- **Dev Agent:** Claude Opus 4.5 - Coding specialist
- **Research Agent:** Perplexity Sonar Pro - Web search specialist
- **Secretary Agent:** Gemini 3 Flash - Productivity specialist
- **Personality Agent:** Grok 4.1 Fast - Creative chat specialist
- **Home Agent:** GPT-5-mini - Smart home specialist
- **Finance Agent:** Gemini 3 Flash - Financial tracking specialist
- **ImageGen Agent:** gpt-image-1.5 - Image generation specialist

## Acronyms

- **API:** Application Programming Interface
- **DB:** Database
- **LLM:** Large Language Model
- **MCP:** Model Context Protocol
- **RSC:** React Server Components
- **SSR:** Server-Side Rendering
- **UI:** User Interface
- **UX:** User Experience

## File Extensions

- `.ts` - TypeScript
- `.tsx` - TypeScript with JSX (React components)
- `.sql` - SQL database scripts
- `.yml`/`.yaml` - YAML configuration
- `.md` - Markdown documentation

## Environment Types

- **Development:** Local machine with hot reload
- **Staging:** Pre-production testing environment
- **Production:** Live user-facing deployment
