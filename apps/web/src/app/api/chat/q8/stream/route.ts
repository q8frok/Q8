/**
 * Q8 (OpenClaw) Streaming Chat Proxy
 *
 * Proxies chat requests to the OpenClaw Gateway's OpenAI-compatible
 * /v1/chat/completions endpoint and translates the response into the
 * app's native SSE event format so the existing useChat hook works unchanged.
 *
 * Gateway env vars:
 *   OPENCLAW_GATEWAY_URL   — e.g. https://xyz.trycloudflare.com
 *   OPENCLAW_GATEWAY_TOKEN — bearer token from openclaw config
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GW_URL   = process.env.OPENCLAW_GATEWAY_URL?.replace(/\/$/, '');
const GW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

/** Emit an SSE event line */
function sse(encoder: TextEncoder, obj: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  if (!GW_URL || !GW_TOKEN) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'OpenClaw gateway not configured (OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN missing)', recoverable: false })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const body = await request.json();
  const { message, threadId, requestId, userProfile } = body as {
    message: string;
    threadId?: string;
    requestId?: string;
    userProfile?: { name?: string; timezone?: string };
  };

  const encoder = new TextEncoder();
  const stream  = new TransformStream();
  const writer  = stream.writable.getWriter();

  const runId = crypto.randomUUID();
  const ts    = () => new Date().toISOString();

  (async () => {
    try {
      // Build conversation context for the gateway
      const systemContent = [
        'You are Q8, a reliable digital operator. Reply in your normal voice.',
        userProfile?.name    ? `User: ${userProfile.name}` : '',
        userProfile?.timezone ? `Timezone: ${userProfile.timezone}` : '',
      ].filter(Boolean).join('\n');

      // Emit lifecycle events the hook expects
      await writer.write(sse(encoder, { type: 'run_created', runId, state: 'queued', timestamp: ts() }));
      await writer.write(sse(encoder, { type: 'run_state',   runId, state: 'queued', timestamp: ts() }));
      await writer.write(sse(encoder, { type: 'routing', agent: 'q8', reason: 'Routed to Q8 (OpenClaw)', confidence: 1, source: 'override' }));
      await writer.write(sse(encoder, { type: 'agent_start', agent: 'q8' }));
      await writer.write(sse(encoder, { type: 'run_state', runId, state: 'running', timestamp: ts() }));

      // Call the gateway
      const gwRes = await fetch(`${GW_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GW_TOKEN}`,
          'Content-Type':  'application/json',
          ...(threadId   ? { 'x-thread-id':   threadId }   : {}),
          ...(requestId  ? { 'x-request-id':  requestId }  : {}),
        },
        body: JSON.stringify({
          model:  'openclaw',
          stream: true,
          messages: [
            ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
            { role: 'user', content: message },
          ],
          // Pass user as stable session key so Q8 keeps context across calls
          user: `webapp:${user.id}${threadId ? `:${threadId}` : ''}`,
        }),
        signal: request.signal,
      });

      if (!gwRes.ok || !gwRes.body) {
        const errText = await gwRes.text().catch(() => gwRes.statusText);
        throw new Error(`Gateway ${gwRes.status}: ${errText.slice(0, 200)}`);
      }

      // Stream gateway SSE → translate to app format
      let fullContent = '';
      const gwReader   = gwRes.body.getReader();
      const gwDecoder  = new TextDecoder();
      let   buf        = '';

      while (true) {
        const { done, value } = await gwReader.read();
        if (done) break;

        buf += gwDecoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const chunk = JSON.parse(raw);
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              fullContent += delta;
              await writer.write(sse(encoder, { type: 'content', delta }));
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }

      // Emit done
      await writer.write(sse(encoder, { type: 'run_state', runId, state: 'completed', timestamp: ts() }));
      await writer.write(sse(encoder, {
        type:        'done',
        fullContent,
        agent:       'q8',
        threadId:    threadId ?? '',
        agentSelection: { agent: 'q8', confidence: 1, rationale: 'Q8 (OpenClaw)', source: 'override' },
        toolSummary: { total: 0, succeeded: 0, failed: 0, tools: [] },
        failure:     null,
      }));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[Q8 Proxy] stream error', { error: msg });
      try {
        await writer.write(sse(encoder, { type: 'run_state', runId, state: 'failed', timestamp: ts() }));
        await writer.write(sse(encoder, { type: 'error', message: msg, recoverable: false }));
      } catch { /* writer may be closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':   'keep-alive',
    },
  });
}
