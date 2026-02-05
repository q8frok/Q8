/**
 * Handoff Pattern for Agent Coordination
 *
 * Implements the OpenAI Agents SDK handoff pattern for explicit transfers
 * of control between agents. Handoffs are:
 * - Explicit transfers from orchestrator to specialist agents
 * - Based on routing decisions with confidence thresholds
 * - Context-preserving to maintain conversation flow
 *
 * Key concepts:
 * - Only orchestrator can initiate handoffs to specialists
 * - Specialists cannot handoff to each other (they return to orchestrator)
 * - Confidence threshold (0.7) prevents low-confidence handoffs
 */

import { logger } from '@/lib/logger';
import { route, type SDKRoutingDecision, type RouteOptions } from './router';
import { getAgentConfig, getAgentName, type AgentType } from './agents';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents a handoff request to transfer control to another agent
 */
export interface Handoff {
  /** The agent type to hand off to */
  targetAgent: AgentType;
  /** Human-readable reason for the handoff */
  reason: string;
  /** Optional context to pass to the target agent */
  context?: Record<string, unknown>;
}

/**
 * Result of the handoff decision process
 */
export interface HandoffDecision {
  /** Whether a handoff should occur */
  shouldHandoff: boolean;
  /** The handoff details if shouldHandoff is true */
  handoff?: Handoff;
  /** Routing decision that led to this handoff decision */
  routingDecision?: SDKRoutingDecision;
}

/**
 * Result of executing a handoff
 */
export interface HandoffResult {
  /** Whether the handoff was successful */
  success: boolean;
  /** The agent that received the handoff */
  targetAgent: AgentType;
  /** Response from the target agent (if available) */
  response?: string;
  /** Error message if handoff failed */
  error?: string;
  /** Context that was passed to the target agent */
  context?: Record<string, unknown>;
}

/**
 * Context for coder agent handoffs
 */
export interface CoderHandoffContext extends Record<string, unknown> {
  repo?: string;
  issue?: number;
  pr?: number;
  branch?: string;
  file?: string;
}

/**
 * Context for researcher agent handoffs
 */
export interface ResearcherHandoffContext extends Record<string, unknown> {
  query?: string;
  sources?: string[];
  depth?: 'quick' | 'thorough';
}

/**
 * Context for secretary agent handoffs
 */
export interface SecretaryHandoffContext extends Record<string, unknown> {
  calendarId?: string;
  emailTo?: string;
  meetingDate?: string;
  documentId?: string;
}

/**
 * Context for personality agent handoffs
 */
export interface PersonalityHandoffContext extends Record<string, unknown> {
  mood?: string;
  topic?: string;
  style?: 'casual' | 'formal' | 'playful';
}

/**
 * Context for home agent handoffs
 */
export interface HomeHandoffContext extends Record<string, unknown> {
  device?: string;
  room?: string;
  action?: string;
  scene?: string;
}

/**
 * Context for finance agent handoffs
 */
export interface FinanceHandoffContext extends Record<string, unknown> {
  category?: string;
  period?: string;
  account?: string;
  amount?: number;
}

/**
 * Context for imagegen agent handoffs
 */
export interface ImageGenHandoffContext extends Record<string, unknown> {
  style?: string;
  size?: string;
  prompt?: string;
  quality?: 'standard' | 'hd';
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Minimum confidence threshold for automatic handoffs
 * Handoffs below this threshold require explicit user request
 */
export const HANDOFF_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Agents that can initiate handoffs (only orchestrator)
 */
const _HANDOFF_INITIATORS: AgentType[] = ['orchestrator'];

/**
 * Valid handoff targets (all specialists)
 */
const HANDOFF_TARGETS: AgentType[] = [
  'coder',
  'researcher',
  'secretary',
  'personality',
  'home',
  'finance',
  'imagegen',
];

// =============================================================================
// HANDOFF CREATION FUNCTIONS
// =============================================================================

/**
 * Create a generic handoff to any agent type
 */
export function createHandoffToAgent(
  targetAgent: AgentType,
  reason: string,
  context?: Record<string, unknown>
): Handoff {
  if (!HANDOFF_TARGETS.includes(targetAgent) && targetAgent !== 'orchestrator') {
    logger.warn('Creating handoff to non-standard target', { targetAgent });
  }

  return {
    targetAgent,
    reason,
    context,
  };
}

/**
 * Create a handoff to the coder agent for development tasks
 */
export function handoffToCoder(
  reason: string,
  context?: CoderHandoffContext
): Handoff {
  return createHandoffToAgent('coder', reason, context);
}

/**
 * Create a handoff to the researcher agent for search/research tasks
 */
export function handoffToResearcher(
  reason: string,
  context?: ResearcherHandoffContext
): Handoff {
  return createHandoffToAgent('researcher', reason, context);
}

/**
 * Create a handoff to the secretary agent for scheduling/email tasks
 */
export function handoffToSecretary(
  reason: string,
  context?: SecretaryHandoffContext
): Handoff {
  return createHandoffToAgent('secretary', reason, context);
}

/**
 * Create a handoff to the personality agent for casual chat/music
 */
export function handoffToPersonality(
  reason: string,
  context?: PersonalityHandoffContext
): Handoff {
  return createHandoffToAgent('personality', reason, context);
}

/**
 * Create a handoff to the home agent for smart home control
 */
export function handoffToHome(
  reason: string,
  context?: HomeHandoffContext
): Handoff {
  return createHandoffToAgent('home', reason, context);
}

/**
 * Create a handoff to the finance agent for financial queries
 */
export function handoffToFinance(
  reason: string,
  context?: FinanceHandoffContext
): Handoff {
  return createHandoffToAgent('finance', reason, context);
}

/**
 * Create a handoff to the imagegen agent for image generation
 */
export function handoffToImageGen(
  reason: string,
  context?: ImageGenHandoffContext
): Handoff {
  return createHandoffToAgent('imagegen', reason, context);
}

/**
 * Create a handoff back to orchestrator (for specialists returning control)
 */
export function handoffToOrchestrator(
  reason: string,
  context?: Record<string, unknown>
): Handoff {
  return createHandoffToAgent('orchestrator', reason, context);
}

// =============================================================================
// HANDOFF DECISION MAKING
// =============================================================================

/**
 * Decide whether to handoff based on routing decision
 *
 * Rules:
 * 1. If routed agent differs from current agent -> suggest handoff
 * 2. Only suggest handoff if confidence > threshold (0.7)
 * 3. Only orchestrator can initiate handoffs to specialists
 * 4. Specialists always return to orchestrator (never handoff to each other)
 */
export async function decideHandoff(
  message: string,
  currentAgent: AgentType,
  options?: RouteOptions
): Promise<HandoffDecision> {
  // Get routing decision
  const routingDecision = await route(message, options);

  logger.debug('Handoff decision evaluation', {
    currentAgent,
    routedAgent: routingDecision.agent,
    confidence: routingDecision.confidence,
    threshold: HANDOFF_CONFIDENCE_THRESHOLD,
  });

  // If routed to same agent, no handoff needed
  if (routingDecision.agent === currentAgent) {
    return {
      shouldHandoff: false,
      routingDecision,
    };
  }

  // Check confidence threshold
  if (routingDecision.confidence < HANDOFF_CONFIDENCE_THRESHOLD) {
    logger.debug('Handoff skipped due to low confidence', {
      confidence: routingDecision.confidence,
      threshold: HANDOFF_CONFIDENCE_THRESHOLD,
    });
    return {
      shouldHandoff: false,
      routingDecision,
    };
  }

  // Check if current agent can initiate handoff
  if (!canHandoff(currentAgent, routingDecision.agent)) {
    logger.debug('Handoff not allowed from current agent', {
      from: currentAgent,
      to: routingDecision.agent,
    });
    return {
      shouldHandoff: false,
      routingDecision,
    };
  }

  // Create handoff
  const handoff = createHandoffToAgent(
    routingDecision.agent,
    routingDecision.rationale
  );

  return {
    shouldHandoff: true,
    handoff,
    routingDecision,
  };
}

// =============================================================================
// HANDOFF EXECUTION
// =============================================================================

/**
 * Execute a handoff to transfer control to another agent
 *
 * This function:
 * 1. Validates the handoff is allowed
 * 2. Prepares context for the target agent
 * 3. Returns result (actual agent invocation is handled by caller)
 *
 * Note: This function does not actually call the target agent's LLM.
 * It prepares the handoff and returns the result for the caller to process.
 */
export async function executeHandoff(
  handoff: Handoff,
  message: string,
  userId: string,
  threadId?: string
): Promise<HandoffResult> {
  const startTime = Date.now();

  try {
    // Validate target agent exists
    const targetConfig = getAgentConfig(handoff.targetAgent);
    if (!targetConfig) {
      return {
        success: false,
        targetAgent: handoff.targetAgent,
        error: `Unknown target agent: ${handoff.targetAgent}`,
      };
    }

    logger.info('Executing handoff', {
      targetAgent: handoff.targetAgent,
      targetName: targetConfig.name,
      reason: handoff.reason,
      userId,
      threadId,
      hasContext: !!handoff.context,
    });

    // Build enhanced context for target agent
    const enhancedContext: Record<string, unknown> = {
      ...handoff.context,
      _handoff: {
        reason: handoff.reason,
        timestamp: new Date().toISOString(),
        userId,
        threadId,
      },
    };

    const elapsed = Date.now() - startTime;
    logger.debug('Handoff prepared', { elapsed, targetAgent: handoff.targetAgent });

    return {
      success: true,
      targetAgent: handoff.targetAgent,
      context: enhancedContext,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Handoff execution failed', {
      targetAgent: handoff.targetAgent,
      error: errorMessage,
      elapsed,
    });

    return {
      success: false,
      targetAgent: handoff.targetAgent,
      error: errorMessage,
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a handoff from one agent to another is allowed
 *
 * Rules:
 * - Orchestrator can handoff to any specialist
 * - Specialists can only return to orchestrator
 * - No self-handoffs
 */
export function canHandoff(fromAgent: AgentType, toAgent: AgentType): boolean {
  // No self-handoffs
  if (fromAgent === toAgent) {
    return false;
  }

  // Orchestrator can handoff to any specialist
  if (fromAgent === 'orchestrator' && HANDOFF_TARGETS.includes(toAgent)) {
    return true;
  }

  // Specialists can only return to orchestrator
  if (HANDOFF_TARGETS.includes(fromAgent) && toAgent === 'orchestrator') {
    return true;
  }

  // All other handoffs are not allowed
  return false;
}

/**
 * Format a handoff message for displaying to the user
 */
export function formatHandoffMessage(handoff: Handoff): string {
  const targetName = getAgentName(handoff.targetAgent);

  // Build a user-friendly message
  const contextSummary = handoff.context
    ? Object.entries(handoff.context)
        .filter(([key]) => !key.startsWith('_'))
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : '';

  const contextPart = contextSummary ? ` (${contextSummary})` : '';

  return `Transferring to ${targetName}: ${handoff.reason}${contextPart}`;
}

/**
 * Get the display name for a handoff target
 */
export function getHandoffTargetName(targetAgent: AgentType): string {
  return getAgentName(targetAgent);
}

/**
 * Check if an agent can receive handoffs
 */
export function isHandoffTarget(agent: AgentType): boolean {
  return HANDOFF_TARGETS.includes(agent) || agent === 'orchestrator';
}

/**
 * Get all valid handoff targets for an agent
 */
export function getValidHandoffTargets(fromAgent: AgentType): AgentType[] {
  if (fromAgent === 'orchestrator') {
    return [...HANDOFF_TARGETS];
  }

  if (HANDOFF_TARGETS.includes(fromAgent)) {
    return ['orchestrator'];
  }

  return [];
}
