/**
 * Pre-flight checks for tool availability
 * Validates credentials before attempting API calls
 */

export type AgentType =
  | 'orchestrator'
  | 'coder'
  | 'researcher'
  | 'secretary'
  | 'personality'
  | 'home'
  | 'finance'
  | 'imagegen';

interface CredentialCheck {
  envKey: string;
  name: string;
}

export interface AvailabilityResult {
  available: boolean;
  missingCredentials: string[];
  degradedTools: string[];
}

/**
 * Credential requirements for each agent
 */
const AGENT_CREDENTIALS: Record<AgentType, CredentialCheck[]> = {
  orchestrator: [
    { envKey: 'OPENAI_API_KEY', name: 'OpenAI' },
  ],
  personality: [
    { envKey: 'SPOTIFY_REFRESH_TOKEN', name: 'Spotify' },
    { envKey: 'OPENWEATHER_API_KEY', name: 'Weather' },
  ],
  coder: [
    { envKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', name: 'GitHub' },
  ],
  researcher: [
    { envKey: 'PERPLEXITY_API_KEY', name: 'Perplexity' },
  ],
  secretary: [
    { envKey: 'GOOGLE_CLIENT_ID', name: 'Google Calendar' },
    { envKey: 'GOOGLE_CLIENT_SECRET', name: 'Google Auth' },
    { envKey: 'YOUTUBE_API_KEY', name: 'YouTube' },
  ],
  home: [
    { envKey: 'HASS_TOKEN', name: 'Home Assistant' },
    { envKey: 'HASS_URL', name: 'Home Assistant URL' },
  ],
  finance: [
    { envKey: 'PLAID_CLIENT_ID', name: 'Plaid Banking' },
    { envKey: 'PLAID_SECRET', name: 'Plaid Secret' },
  ],
  imagegen: [
    { envKey: 'OPENAI_API_KEY', name: 'OpenAI Images' },
  ],
};

/**
 * Check if a credential value is valid (not empty, placeholder, or whitespace)
 */
function isValidCredential(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (trimmed === 'placeholder') return false;
  return true;
}

/**
 * Check if all required credentials are available for an agent
 */
export function checkToolAvailability(agent: AgentType): AvailabilityResult {
  const required = AGENT_CREDENTIALS[agent] || [];
  const missing: string[] = [];
  const degraded: string[] = [];

  for (const check of required) {
    const value = process.env[check.envKey];
    if (!isValidCredential(value)) {
      missing.push(check.name);
      degraded.push(check.name);
    }
  }

  return {
    available: missing.length === 0,
    missingCredentials: missing,
    degradedTools: degraded,
  };
}

/**
 * Check availability for all agents
 */
export function checkAllAgentsAvailability(): Record<AgentType, AvailabilityResult> {
  const agents: AgentType[] = [
    'orchestrator',
    'coder',
    'researcher',
    'secretary',
    'personality',
    'home',
    'finance',
    'imagegen',
  ];

  const results: Record<string, AvailabilityResult> = {};
  for (const agent of agents) {
    results[agent] = checkToolAvailability(agent);
  }

  return results as Record<AgentType, AvailabilityResult>;
}

/**
 * Get a summary of which tools are available
 */
export function getAvailabilityReport(): string {
  const results = checkAllAgentsAvailability();
  const lines: string[] = ['Agent Tool Availability:'];

  for (const [agent, result] of Object.entries(results)) {
    const status = result.available ? '[OK]' : '[MISSING]';
    const missing = result.missingCredentials.length > 0
      ? ` (missing: ${result.missingCredentials.join(', ')})`
      : '';
    lines.push(`  ${status} ${agent}${missing}`);
  }

  return lines.join('\n');
}
