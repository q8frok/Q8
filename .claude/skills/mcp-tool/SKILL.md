# /mcp-tool — MCP Tool Integration

Patterns for integrating external tools via Model Context Protocol (MCP).

## Auto-Invocation
This skill activates automatically when creating MCP tool integrations.

## MCP Client Template

```typescript
// apps/web/src/lib/mcp/<service>.ts
import { MCPClient } from '@/lib/mcp/client';

export class <Service>MCPClient {
  private client: MCPClient;

  constructor(config: { token: string; baseUrl?: string }) {
    this.client = new MCPClient({
      name: '<service>',
      version: '1.0.0',
      ...config,
    });
  }

  async getTools() {
    return this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.client.callTool(name, args);
  }
}
```

## Existing MCP Integrations
- **GitHub** — `lib/mcp/github`: PRs, issues, code search
- **Google Workspace** — `lib/mcp/google`: Calendar, Gmail, Docs
- **Spotify** — `lib/mcp/spotify`: Playback, playlists
- **Supabase** — via MCP server: DB operations, migrations
- **Home Assistant** — `lib/mcp/hass`: Smart home control

## Rules
- MCP tools are the only way agents interact with external services.
- Each MCP client goes in `apps/web/src/lib/mcp/`.
- MCP servers (standalone) go in `apps/mcp-servers/<service>/`.
- Tools must return structured data (JSON), not raw text.
- Handle auth tokens via environment variables, never hardcode.
- Register tool schemas with Zod for type safety.
- MCP servers can run as microservices or imported directly (Node.js compatible).
