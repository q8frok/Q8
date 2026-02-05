# /agent — AI Agent & Sub-Agent Patterns

Patterns for creating agents in Q8's swarm architecture using OpenAI Agents SDK.

## Auto-Invocation
This skill activates automatically when creating or modifying AI agents.

## Sub-Agent Template

```typescript
// apps/web/src/lib/agents/sub-agents/<name>.ts
import { Agent } from '@openai/agents';
import { getModel } from '@/lib/agents/model_factory';

export const <name>Agent = new Agent({
  name: '<DisplayName>',
  model: getModel('<role>'),
  instructions: `You are Q8's <role> specialist.

    Your responsibilities:
    - ...

    Always maintain Q8's unified personality.
  `,
  tools: [/* MCP tools */],
  handoffs: [/* other agents if needed */],
});
```

## Model Factory Roles
- `orchestrator` → GPT-5.1 (main router)
- `coder` → Claude Sonnet 4.5 (development tasks)
- `researcher` → Perplexity Sonar Pro (search & research)
- `secretary` → Gemini 3.0 Pro (docs, calendar, email)
- `personality` → Grok 4.1 (casual chat)

## Rules
- Always use `getModel()` from model_factory — never hardcode model strings.
- Agent instructions must reinforce Q8's unified persona.
- MCP tools are loaded via their respective clients in `lib/mcp/`.
- Handoffs define which agents can delegate to others.
- Place sub-agents in `apps/web/src/lib/agents/sub-agents/`.
- The orchestrator in `apps/web/src/lib/agents/index.ts` must register all sub-agents.
- Mock LLM responses in tests — never burn API credits.
