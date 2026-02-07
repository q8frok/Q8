/**
 * Agent Module
 * Unified entry point for the OpenAI Agents SDK orchestration system.
 *
 * ARCHITECTURE:
 * The active execution path is lib/agents/sdk/ which uses @openai/agents SDK.
 * This file re-exports the SDK services and shared types.
 *
 * Usage:
 *   import { executeChatStream } from '@/lib/agents';
 *   import type { AgentType, OrchestrationEvent } from '@/lib/agents';
 */

// ============================================================================
// SDK SERVICE EXPORTS
// ============================================================================

export { executeChatStream, executeChat } from './sdk/chat-service';
export { streamMessage } from './sdk/runner';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Agent types from SDK
export type { AgentType } from './sdk/agents';

// Orchestration event types (shared contract between backend & frontend)
export type {
  OrchestrationEvent,
  ExtendedAgentType,
  RoutingDecision,
  ToolEvent,
  AgentCapability,
  RoutingPolicy,
  ConversationMode,
  InputMethod,
  WidgetId,
} from './orchestration/types';

export { DEFAULT_ROUTING_POLICY } from './orchestration/types';

// Model provider
export { getAgentModel, getAgentModelName, getRouterModel } from './sdk/model-provider';

// Display config
export { getAgentDisplayConfig, type AgentRole } from './display-config';

// Shared types
export * from './types';
