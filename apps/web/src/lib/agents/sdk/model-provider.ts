/**
 * Model Provider for @openai/agents SDK
 *
 * OpenAI-only: returns native model name strings.
 * The SDK uses these directly with the Responses API, which handles:
 * - Reasoning items & previous_response_id natively
 * - Built-in hosted tools (web_search, image_generation, code_interpreter)
 * - Token-level streaming without adapter overhead
 *
 * Model assignments:
 * - gpt-5.2: orchestrator, coder, researcher, personality, imagegen (flagship)
 * - gpt-5-mini: secretary, home, finance (fast, cost-efficient, excellent tool calling)
 * - gpt-5-nano: router only (ultra-fast classification)
 *
 * Override via environment variables (see model_factory.ts ENV_OVERRIDES).
 */

import type { AgentType } from '../model_factory';

// =============================================================================
// Model Mapping
// =============================================================================

/**
 * Default model for each agent type.
 * Uses OpenAI model name strings — the SDK's Agent constructor accepts these directly.
 */
const AGENT_MODELS: Record<AgentType, string> = {
  orchestrator: 'gpt-5.2',
  coder: 'gpt-5.2',
  researcher: 'gpt-5.2',
  secretary: 'gpt-5-mini',
  personality: 'gpt-5.2',
  home: 'gpt-5-mini',
  finance: 'gpt-5-mini',
  imagegen: 'gpt-5.2',
};

/**
 * Environment variable overrides per agent type.
 * Allows runtime model swaps without code changes.
 */
const ENV_OVERRIDES: Record<AgentType, string> = {
  orchestrator: 'Q8_ORCHESTRATOR_MODEL',
  coder: 'Q8_CODER_MODEL',
  researcher: 'Q8_RESEARCH_MODEL',
  secretary: 'Q8_SECRETARY_MODEL',
  personality: 'Q8_PERSONALITY_MODEL',
  home: 'Q8_HOME_MODEL',
  finance: 'Q8_FINANCE_MODEL',
  imagegen: 'Q8_IMAGEGEN_MODEL',
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the OpenAI model name for a given agent type.
 * Returns a plain string — the SDK uses it directly with the Responses API.
 */
export function getAgentModel(agentType: AgentType): string {
  const envKey = ENV_OVERRIDES[agentType];
  const override = envKey ? process.env[envKey] : undefined;
  return override || AGENT_MODELS[agentType];
}

/**
 * Get the model identifier string for an agent (for logging/display)
 */
export function getAgentModelName(agentType: AgentType): string {
  return getAgentModel(agentType);
}

/**
 * Get the router model name (gpt-5-nano for ultra-fast classification)
 */
export function getRouterModel(): string {
  return process.env.Q8_ROUTER_MODEL || 'gpt-5-nano';
}
