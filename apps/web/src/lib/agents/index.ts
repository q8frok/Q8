/**
 * Agent Module
 * Unified entry point for multi-agent orchestration
 *
 * ARCHITECTURE:
 * All agent functionality is now centralized in lib/agents/orchestration/service.ts.
 * This file serves as a clean re-export layer.
 *
 * Usage:
 *   import { processMessage, streamMessage } from '@/lib/agents';
 *   // OR import directly from orchestration
 *   import { processMessage, streamMessage } from '@/lib/agents/orchestration';
 */

// ============================================================================
// UNIFIED ORCHESTRATION SERVICE EXPORTS
// ============================================================================

// Service functions
export { processMessage, streamMessage } from './orchestration/service';

// Types
export type {
  OrchestrationRequest,
  OrchestrationResponse,
  OrchestrationEvent,
  ExtendedAgentType,
  RoutingDecision,
  ToolEvent,
  AgentCapability,
  RoutingPolicy,
} from './orchestration/types';

export { DEFAULT_ROUTING_POLICY } from './orchestration/types';

// Router functions (for advanced usage)
export { route, heuristicRoute, llmRoute, AGENT_CAPABILITIES } from './orchestration/router';

// Metrics (for telemetry/debugging)
export {
  logRoutingTelemetry,
  recordImplicitFeedback,
  getRoutingMetrics,
} from './orchestration/metrics';

// ============================================================================
// MODEL & TYPE EXPORTS
// ============================================================================

export * from './types';
export * from './model_factory';
