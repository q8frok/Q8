/**
 * gpt-5-nano Router with OpenAI Structured Outputs
 *
 * Intelligent routing using gpt-5-nano ($0.05/1M tokens) with guaranteed
 * JSON schema compliance via OpenAI Structured Outputs.
 *
 * Routing priority:
 * 1. Explicit agent mentions ("ask the coder to...")
 * 2. Keyword-based fast routing (no LLM call)
 * 3. LLM-based intent classification (gpt-5-nano)
 * 4. Default to orchestrator for ambiguous requests
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { logger } from '@/lib/logger';
import type { AgentType } from './agents';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available agents for routing
 */
export const ROUTABLE_AGENTS = [
  'orchestrator',
  'coder',
  'researcher',
  'secretary',
  'personality',
  'home',
  'finance',
  'imagegen',
] as const;

export type RoutableAgent = (typeof ROUTABLE_AGENTS)[number];

/**
 * Source of routing decision
 */
export type RoutingSource = 'explicit' | 'keyword' | 'llm' | 'fallback';

/**
 * Routing decision with structured output
 */
export interface SDKRoutingDecision {
  /** Selected agent for the task */
  agent: RoutableAgent;
  /** Confidence score (0-1) for the routing decision */
  confidence: number;
  /** Explanation for why this agent was selected */
  rationale: string;
  /** Source of routing decision */
  source: RoutingSource;
}

// =============================================================================
// ZOD SCHEMAS FOR STRUCTURED OUTPUTS
// =============================================================================

/**
 * Zod schema for LLM routing response
 * Used with OpenAI Structured Outputs for guaranteed schema compliance
 */
export const RoutingDecisionSchema = z.object({
  agent: z.enum(ROUTABLE_AGENTS),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export type ParsedRoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// =============================================================================
// EXPLICIT AGENT PATTERNS
// =============================================================================

/**
 * Patterns for detecting explicit agent requests
 * e.g., "ask the coder to...", "have the researcher find..."
 */
const EXPLICIT_AGENT_PATTERNS: Array<{ pattern: RegExp; agent: RoutableAgent }> = [
  // Coder patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:coder|dev(?:bot)?|developer)\b/i, agent: 'coder' },
  { pattern: /@coder\b/i, agent: 'coder' },

  // Researcher patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:researcher|research(?:bot)?)\b/i, agent: 'researcher' },
  { pattern: /@researcher\b/i, agent: 'researcher' },

  // Secretary patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:secretary|secretarybot)\b/i, agent: 'secretary' },
  { pattern: /@secretary\b/i, agent: 'secretary' },

  // Personality patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:personality|q8)\b/i, agent: 'personality' },
  { pattern: /@personality\b/i, agent: 'personality' },
  { pattern: /@q8\b/i, agent: 'personality' },

  // Home patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:home(?:bot)?|smart\s*home)\b/i, agent: 'home' },
  { pattern: /@home\b/i, agent: 'home' },

  // Finance patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:finance|finance\s*(?:bot|advisor)?)\b/i, agent: 'finance' },
  { pattern: /@finance\b/i, agent: 'finance' },

  // ImageGen patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?(?:imagegen|image\s*gen(?:erator)?)\b/i, agent: 'imagegen' },
  { pattern: /@imagegen\b/i, agent: 'imagegen' },

  // Orchestrator patterns
  { pattern: /\b(?:ask|have|let|get)\s+(?:the\s+)?orchestrator\b/i, agent: 'orchestrator' },
  { pattern: /@orchestrator\b/i, agent: 'orchestrator' },
];

// =============================================================================
// KEYWORD PATTERNS FOR FAST ROUTING
// =============================================================================

/**
 * Keyword patterns for fast routing without LLM
 * Organized by agent with multi-word phrases (higher priority) and single words
 */
const KEYWORD_PATTERNS: Record<RoutableAgent, { phrases: string[]; words: string[] }> = {
  coder: {
    phrases: [
      'code review', 'pull request', 'bug fix', 'debug this', 'fix the bug',
      'implement feature', 'write code', 'refactor', 'git commit', 'git push',
      'create branch', 'merge request', 'code change', 'review this code',
      'review my code', 'this code',
    ],
    words: [
      'code', 'coding', 'debug', 'debugging', 'github', 'pr', 'repo', 'repository',
      'bug', 'bugs', 'error', 'exception', 'function', 'class', 'sql', 'database', 'api',
      'endpoint', 'commit', 'merge', 'branch', 'implement', 'typescript', 'javascript',
      'query', 'users', 'review',
    ],
  },
  researcher: {
    phrases: [
      'search for', 'find out', 'look up', 'research about', 'tell me about',
      'what is', 'how does', 'explain', 'latest news', 'current events',
      'the latest', 'search the',
    ],
    words: [
      'search', 'find', 'research', 'news', 'latest', 'current', 'article',
      'source', 'reference', 'information', 'wikipedia', 'define', 'compare',
      'papers',
    ],
  },
  secretary: {
    phrases: [
      'schedule meeting', 'send email', 'check calendar', 'book appointment',
      'create event', 'reschedule', 'cancel meeting', 'email draft', 'gmail',
      'google drive', 'youtube video', 'search youtube', 'send an email',
      'schedule a meeting',
    ],
    words: [
      'calendar', 'schedule', 'email', 'meeting', 'appointment', 'remind',
      'task', 'event', 'invite', 'agenda', 'availability', 'youtube', 'video',
      'john', 'project',
    ],
  },
  personality: {
    phrases: [
      'play music', 'play song', 'spotify', 'now playing', 'what is playing',
      'next song', 'previous song', 'turn up', 'turn down', 'add to queue',
      'how are you', 'tell me a joke', 'chat with me', 'play some music',
      'some music', 'a joke', 'funny joke',
    ],
    words: [
      'music', 'song', 'playlist', 'album', 'artist', 'spotify', 'queue',
      'volume', 'skip', 'pause', 'playing', 'track', 'listen', 'hello', 'hi',
      'hey', 'thanks', 'joke', 'funny', 'story', 'chat', 'talk', 'opinion', 'think',
    ],
  },
  home: {
    phrases: [
      'turn on', 'turn off', 'set temperature', 'dim lights', 'smart home',
      'activate scene', 'lock door', 'unlock door', 'adjust thermostat',
      'the lights', 'living room', 'how did i sleep', 'sleep score',
      'readiness score', 'oura ring', 'bio rhythm', 'sleep last night',
      'sleep data', 'sleep quality',
    ],
    words: [
      'light', 'lights', 'lamp', 'thermostat', 'temperature', 'lock', 'door',
      'blinds', 'fan', 'hvac', 'scene', 'automation', 'device', 'sensor',
      'climate', 'brightness', 'dim', 'switch', 'degrees', 'movie', 'activate',
      'sleep', 'oura', 'readiness', 'hrv', 'heartrate',
    ],
  },
  finance: {
    phrases: [
      'check balance', 'spending summary', 'budget analysis', 'net worth',
      'can i afford', 'upcoming bills', 'subscription audit', 'expense report',
      'my budget', 'my spending', 'monthly budget', 'how much',
    ],
    words: [
      'money', 'finance', 'budget', 'spending', 'expense', 'income', 'save',
      'savings', 'invest', 'investment', 'stock', 'portfolio', 'balance',
      'transaction', 'bill', 'payment', 'subscription', 'afford', 'cost',
      'price', 'bank', 'credit', 'debt', 'loan', 'wealth', 'monthly', 'laptop',
    ],
  },
  imagegen: {
    phrases: [
      'generate image', 'create image', 'make image', 'draw me', 'create picture',
      'generate picture', 'create diagram', 'make diagram', 'draw diagram',
      'create chart', 'pie chart', 'bar chart', 'analyze image', 'describe image',
      'generate an image', 'create a diagram', 'make a pie chart',
    ],
    words: [
      'image', 'picture', 'photo', 'visual', 'graphic', 'artwork', 'drawing',
      'visualize', 'illustration', 'infographic', 'mockup', 'sketch', 'render',
      'diagram', 'graph', 'chart', 'flowchart', 'sunset', 'architecture', 'expenses',
    ],
  },
  orchestrator: {
    phrases: [],
    words: [],
  },
};

// =============================================================================
// ROUTING FUNCTIONS
// =============================================================================

/**
 * Check for explicit agent mentions in the message
 */
export function checkExplicitAgentRequest(message: string): SDKRoutingDecision | null {
  for (const { pattern, agent } of EXPLICIT_AGENT_PATTERNS) {
    if (pattern.test(message)) {
      logger.debug('Explicit agent request detected', { agent, pattern: pattern.source });
      return {
        agent,
        confidence: 0.99,
        rationale: `Explicit request to use ${agent} agent`,
        source: 'explicit',
      };
    }
  }
  return null;
}

/**
 * Fast keyword-based routing without LLM call
 *
 * Scoring system:
 * - Multi-word phrase match: 3 points (high specificity)
 * - Single word match: 1 point
 * - Minimum threshold: 2 points for a match
 */
export function keywordRoute(message: string): SDKRoutingDecision | null {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/);

  let bestMatch: { agent: RoutableAgent; score: number; matchedTerms: string[] } | null = null;

  for (const [agent, patterns] of Object.entries(KEYWORD_PATTERNS) as [RoutableAgent, typeof KEYWORD_PATTERNS[RoutableAgent]][]) {
    if (agent === 'orchestrator') continue; // Skip orchestrator for keyword routing

    let score = 0;
    const matchedTerms: string[] = [];

    // Check multi-word phrases (higher specificity = more points)
    for (const phrase of patterns.phrases) {
      if (lowerMessage.includes(phrase)) {
        score += 3;
        matchedTerms.push(phrase);
      }
    }

    // Check single words
    for (const word of patterns.words) {
      if (words.includes(word)) {
        score += 1;
        matchedTerms.push(word);
      }
    }

    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { agent, score, matchedTerms };
    }
  }

  // Minimum threshold of 2 points for a match
  if (!bestMatch || bestMatch.score < 2) {
    return null;
  }

  // Calculate confidence based on score
  // 2-3 points: 0.7-0.75, 4-5 points: 0.8-0.85, 6+ points: 0.9+
  const confidence = Math.min(0.95, 0.65 + bestMatch.score * 0.05);

  logger.debug('Keyword routing matched', {
    agent: bestMatch.agent,
    score: bestMatch.score,
    matchedTerms: bestMatch.matchedTerms.slice(0, 5),
    confidence,
  });

  return {
    agent: bestMatch.agent,
    confidence,
    rationale: `Keyword match: ${bestMatch.matchedTerms.slice(0, 3).join(', ')}`,
    source: 'keyword',
  };
}

/**
 * LLM-based routing using gpt-5-nano with Structured Outputs
 */
export async function llmRoute(
  message: string,
  openaiClient?: OpenAI
): Promise<SDKRoutingDecision> {
  const startTime = Date.now();

  try {
    // Use provided client or create new one
    const client = openaiClient ?? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 15000,
    });

    const systemPrompt = `You are a routing classifier for a multi-agent AI assistant. Analyze the user's message and select the best agent.

## Available Agents

- **orchestrator**: General coordination, complex multi-step tasks, unclear requests
- **coder**: Software development, debugging, GitHub operations, code review, SQL/database
- **researcher**: Real-time web search, fact verification, news, documentation lookup
- **secretary**: Email (Gmail), calendar, Google Drive, meeting coordination, YouTube
- **personality**: General chat, creative writing, music/Spotify control, casual conversation
- **home**: Smart home control (lights, thermostat, locks, scenes, devices)
- **finance**: Personal finance, budgeting, spending analysis, bill tracking, investments
- **imagegen**: Image generation, diagram creation, charts, image analysis

## Instructions

Select the agent most likely to successfully complete the user's task.
Consider the primary intent of the message.
If unclear or multi-faceted, choose orchestrator.

Respond with:
- agent: The selected agent ID
- confidence: Your confidence (0-1) in this choice
- rationale: Brief explanation (1 sentence)`;

    const completion = await client.chat.completions.parse({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: zodResponseFormat(RoutingDecisionSchema, 'routing_decision'),
      max_tokens: 150,
      temperature: 0.1,
    });

    const elapsed = Date.now() - startTime;
    const parsed = completion.choices[0]?.message?.parsed;

    if (!parsed) {
      throw new Error('No parsed response from LLM');
    }

    logger.info('LLM routing completed', {
      agent: parsed.agent,
      confidence: parsed.confidence,
      latencyMs: elapsed,
    });

    return {
      agent: parsed.agent,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      source: 'llm',
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error('LLM routing failed', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: elapsed,
    });

    // Return fallback decision
    return {
      agent: 'orchestrator',
      confidence: 0.5,
      rationale: 'LLM routing failed, defaulting to orchestrator',
      source: 'fallback',
    };
  }
}

// =============================================================================
// MAIN ROUTING FUNCTION
// =============================================================================

export interface RouteOptions {
  /** Skip LLM routing and only use keyword/explicit matching */
  skipLLM?: boolean;
  /** Custom OpenAI client (for testing) */
  openaiClient?: OpenAI;
  /** Minimum keyword confidence to skip LLM */
  keywordConfidenceThreshold?: number;
}

/**
 * Route a message to the appropriate agent
 *
 * Routing priority:
 * 1. Explicit agent mentions ("ask the coder to...")
 * 2. Keyword-based fast routing (no LLM call)
 * 3. LLM-based intent classification (gpt-5-nano)
 * 4. Default to orchestrator for ambiguous requests
 */
export async function route(
  message: string,
  options: RouteOptions = {}
): Promise<SDKRoutingDecision> {
  const {
    skipLLM = false,
    openaiClient,
    keywordConfidenceThreshold = 0.8,
  } = options;

  // 1. Check for explicit agent requests (highest priority)
  const explicitResult = checkExplicitAgentRequest(message);
  if (explicitResult) {
    return explicitResult;
  }

  // 2. Try keyword-based routing (fast, no API call)
  const keywordResult = keywordRoute(message);
  if (keywordResult) {
    // If high confidence keyword match, skip LLM
    if (keywordResult.confidence >= keywordConfidenceThreshold || skipLLM) {
      return keywordResult;
    }
  }

  // 3. Use LLM for routing (unless skipped)
  if (!skipLLM && process.env.OPENAI_API_KEY) {
    const llmResult = await llmRoute(message, openaiClient);

    // If keyword result exists but LLM is more confident, use LLM
    if (keywordResult && llmResult.source !== 'fallback') {
      // If they agree, boost confidence
      if (keywordResult.agent === llmResult.agent) {
        return {
          ...llmResult,
          confidence: Math.min(0.99, llmResult.confidence + 0.1),
          rationale: `${llmResult.rationale} (confirmed by keyword match)`,
        };
      }
      // If LLM is more confident, use it
      if (llmResult.confidence > keywordResult.confidence) {
        return llmResult;
      }
      // Otherwise use keyword result
      return keywordResult;
    }

    return llmResult;
  }

  // 4. Return keyword result if available, or default to orchestrator
  if (keywordResult) {
    return keywordResult;
  }

  return {
    agent: 'orchestrator',
    confidence: 0.5,
    rationale: 'No specific intent detected, using orchestrator',
    source: 'fallback',
  };
}

// =============================================================================
// TYPE COMPATIBILITY
// =============================================================================

/**
 * Convert SDKRoutingDecision to the existing RoutingDecision type
 * for backwards compatibility with the orchestration system
 */
export function toOrchestrationRoutingDecision(
  decision: SDKRoutingDecision
): {
  agent: AgentType;
  confidence: number;
  rationale: string;
  source: 'llm' | 'heuristic' | 'fallback' | 'vector';
} {
  // Map source to orchestration source type
  const sourceMap: Record<RoutingSource, 'llm' | 'heuristic' | 'fallback' | 'vector'> = {
    explicit: 'heuristic',
    keyword: 'heuristic',
    llm: 'llm',
    fallback: 'fallback',
  };

  return {
    agent: decision.agent as AgentType,
    confidence: decision.confidence,
    rationale: decision.rationale,
    source: sourceMap[decision.source],
  };
}
