/**
 * Model Factory - Multi-Provider Model Selection with Fallbacks
 *
 * Model Strategy (as of Jan 2026):
 * - Orchestrator: GPT-5.2 (best agentic) → GPT-5-mini → GPT-5-nano
 * - DevBot: Claude Opus 4.5 → Sonnet 4.5 → GPT-5.2 → GPT-5-mini
 * - ResearchBot: sonar-reasoning-pro → sonar-pro → sonar → GPT-5-mini
 * - SecretaryBot: Gemini 3 Flash → Gemini 3 Pro → GPT-5-mini
 * - HomeBot: GPT-5-mini → GPT-5.2 → GPT-5-nano
 * - FinanceBot: Gemini 3 Flash → Gemini 3 Pro → GPT-5-mini
 * - PersonalityBot: Grok 4.1 Fast → GPT-5.2 → GPT-5-mini → GPT-5-nano
 * - ImageGen: GPT-5-mini (orchestration); gpt-image-1.5 (generation)
 */

// =============================================================================
// TYPES
// =============================================================================

export type AgentType =
  | 'orchestrator'
  | 'coder'
  | 'researcher'
  | 'secretary'
  | 'personality'
  | 'home'
  | 'finance'
  | 'imagegen';

export interface ModelConfig {
  /** Model identifier (e.g., 'gpt-5.2', 'claude-opus-4-5-20250929') */
  model: string;
  /** Optional base URL for non-OpenAI providers */
  baseURL?: string;
  /** API key for this provider */
  apiKey?: string;
  /** Provider name for logging */
  provider?: string;
  /** Whether this is a fallback model */
  isFallback?: boolean;
  /** Whether this model supports image/vision input */
  supportsVision?: boolean;
  /** Whether this model can generate images */
  supportsImageGen?: boolean;
  /** Maximum number of images for input (for vision models) */
  maxImageInputs?: number;
  /** Maximum output resolution for image generation */
  maxImageResolution?: '1k' | '2k' | '4k';
}

export interface ModelDefinition {
  model: string;
  baseURL?: string;
  envKey: string;
  provider: string;
}

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

/**
 * Primary models for each agent type
 * Can be overridden via environment variables
 */
export const PRIMARY_MODELS: Record<AgentType, ModelDefinition> = {
  orchestrator: {
    model: 'gpt-5.2',
    envKey: 'OPENAI_API_KEY',
    provider: 'openai',
  },
  coder: {
    model: 'claude-opus-4-5-20251101',
    baseURL: 'https://api.anthropic.com/v1/',
    envKey: 'ANTHROPIC_API_KEY',
    provider: 'anthropic',
  },
  researcher: {
    model: 'sonar-reasoning-pro',
    baseURL: 'https://api.perplexity.ai',
    envKey: 'PERPLEXITY_API_KEY',
    provider: 'perplexity',
  },
  secretary: {
    model: 'gemini-3-flash-preview',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    envKey: 'GOOGLE_GENERATIVE_AI_KEY',
    provider: 'google',
  },
  personality: {
    model: 'grok-4-1-fast',
    baseURL: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    provider: 'xai',
  },
  home: {
    model: 'gpt-5-mini',
    envKey: 'OPENAI_API_KEY',
    provider: 'openai',
  },
  finance: {
    model: 'gemini-3-flash-preview',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    envKey: 'GOOGLE_GENERATIVE_AI_KEY',
    provider: 'google',
  },
  imagegen: {
    model: 'gpt-5-mini',
    envKey: 'OPENAI_API_KEY',
    provider: 'openai',
  },
};

/**
 * Fallback chains for each agent type
 * Used when primary model's API key is not available
 */
export const FALLBACK_CHAINS: Record<AgentType, ModelDefinition[]> = {
  orchestrator: [
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-nano', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  coder: [
    {
      model: 'claude-sonnet-4-5-20250929',
      baseURL: 'https://api.anthropic.com/v1/',
      envKey: 'ANTHROPIC_API_KEY',
      provider: 'anthropic',
    },
    { model: 'gpt-5.2', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  researcher: [
    {
      model: 'sonar-pro',
      baseURL: 'https://api.perplexity.ai',
      envKey: 'PERPLEXITY_API_KEY',
      provider: 'perplexity',
    },
    {
      model: 'sonar',
      baseURL: 'https://api.perplexity.ai',
      envKey: 'PERPLEXITY_API_KEY',
      provider: 'perplexity',
    },
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  secretary: [
    {
      model: 'gemini-3-pro-preview',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      envKey: 'GOOGLE_GENERATIVE_AI_KEY',
      provider: 'google',
    },
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  personality: [
    { model: 'gpt-5.2', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-nano', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  home: [
    { model: 'gpt-5.2', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-nano', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  finance: [
    {
      model: 'gemini-3-pro-preview',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      envKey: 'GOOGLE_GENERATIVE_AI_KEY',
      provider: 'google',
    },
    { model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
  imagegen: [
    { model: 'gpt-5.2', envKey: 'OPENAI_API_KEY', provider: 'openai' },
    { model: 'gpt-5-nano', envKey: 'OPENAI_API_KEY', provider: 'openai' },
  ],
};

/**
 * Environment variable overrides for model selection
 * Format: Q8_{AGENT_TYPE}_MODEL (e.g., Q8_CODER_MODEL)
 */
export const MODEL_ENV_OVERRIDES: Record<AgentType, string> = {
  orchestrator: 'Q8_ROUTER_MODEL',
  coder: 'Q8_CODER_MODEL',
  researcher: 'Q8_RESEARCHER_MODEL',
  secretary: 'Q8_SECRETARY_MODEL',
  personality: 'Q8_PERSONALITY_MODEL',
  home: 'Q8_HOME_MODEL',
  finance: 'Q8_FINANCE_MODEL',
  imagegen: 'Q8_IMAGEGEN_MODEL',
};

/**
 * Human-friendly agent names for display
 */
export const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  orchestrator: 'Q8',
  coder: 'DevBot',
  researcher: 'ResearchBot',
  secretary: 'SecretaryBot',
  personality: 'Q8',
  home: 'HomeBot',
  finance: 'FinanceBot',
  imagegen: 'ImageBot',
};
