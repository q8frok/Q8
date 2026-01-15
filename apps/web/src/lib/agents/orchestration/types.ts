/**
 * Orchestration Types
 * Shared types for the unified orchestration system
 */

import type { AgentType } from '../model_factory';
import type { EnrichedContext } from '../types';

/**
 * Extended agent types including finance advisor
 */
export type ExtendedAgentType = AgentType | 'finance';

/**
 * Routing decision with structured output
 * Phase 2 enhancement: includes performance-based routing
 */
export interface RoutingDecision {
  /** Selected agent for the task */
  agent: ExtendedAgentType;
  /** Confidence score (0-1) for the routing decision */
  confidence: number;
  /** Explanation for why this agent was selected */
  rationale: string;
  /** Fallback agent if primary fails or confidence is low */
  fallbackAgent?: ExtendedAgentType;
  /** Planned tools to use (if known) */
  toolPlan?: string[];
  /** Source of routing decision */
  source: 'llm' | 'heuristic' | 'fallback';
  /** Performance metrics that influenced this decision */
  performanceContext?: {
    agentSuccessRate?: number;
    avgLatency?: number;
    recentFailures?: number;
  };
}

/**
 * Tool execution event for streaming
 */
export interface ToolEvent {
  id: string;
  type: 'start' | 'end';
  tool: string;
  args?: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  duration?: number;
  timestamp: Date;
}

/**
 * Streaming event types for unified output
 */
export type OrchestrationEvent =
  | { type: 'routing'; decision: RoutingDecision }
  | { type: 'agent_start'; agent: ExtendedAgentType }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; id: string }
  | { type: 'tool_end'; tool: string; success: boolean; result?: unknown; id: string; duration?: number }
  | { type: 'content'; delta: string }
  | { type: 'citation'; source: string; url?: string; relevance?: number }
  | { type: 'memory_used'; memoryId: string; content: string; relevance: number }
  | { type: 'done'; fullContent: string; agent: ExtendedAgentType; threadId: string }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'error'; message: string; recoverable?: boolean };

/**
 * Orchestration request input
 */
export interface OrchestrationRequest {
  message: string;
  userId: string;
  threadId?: string;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
  /** Override automatic routing */
  forceAgent?: ExtendedAgentType;
  /** Include tool execution visibility */
  showToolExecutions?: boolean;
}

/**
 * Orchestration response output
 */
export interface OrchestrationResponse {
  content: string;
  agent: ExtendedAgentType;
  threadId: string;
  routing: RoutingDecision;
  toolExecutions?: ToolEvent[];
  memoriesUsed?: Array<{ id: string; content: string; relevance: number }>;
  citations?: Array<{ source: string; url?: string }>;
  metadata?: {
    latency: number;
    tokenUsage?: { input: number; output: number };
    model: string;
  };
}

/**
 * Agent capability definition for routing
 */
export interface AgentCapability {
  agent: ExtendedAgentType;
  name: string;
  description: string;
  capabilities: string[];
  keywords: string[];
  tools: string[];
  /** Average success rate (0-1) */
  successRate?: number;
  /** Average latency in ms */
  avgLatency?: number;
}

/**
 * Routing policy weights
 * Priority: task success > latency > cost
 */
export interface RoutingPolicy {
  /** Weight for task success (highest priority) */
  successWeight: number;
  /** Weight for latency (second priority) */
  latencyWeight: number;
  /** Weight for cost (third priority) */
  costWeight: number;
  /** Minimum confidence threshold to use LLM routing */
  minLLMConfidence: number;
  /** Maximum latency allowed for LLM routing (ms) */
  maxLLMRoutingLatency: number;
}

/**
 * Default routing policy
 */
export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  successWeight: 0.6,
  latencyWeight: 0.25,
  costWeight: 0.15,
  minLLMConfidence: 0.7,
  maxLLMRoutingLatency: 500,
};
