/**
 * Message utilities for chat components
 *
 * Agent display config is re-exported from the canonical source in lib/agents/display-config.ts.
 * Only formatTimestamp is defined locally.
 */

export {
  getAgentDisplayConfig as getAgentConfig,
  type AgentDisplayConfig as AgentConfig,
  type AgentRole,
} from '@/lib/agents/display-config';

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
