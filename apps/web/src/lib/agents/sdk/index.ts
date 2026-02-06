/**
 * OpenAI Agents SDK Implementation
 *
 * Uses @openai/agents for:
 * - Agent definitions with handoffs
 * - Tool execution via SDK tool() format
 * - Streaming via run(agent, input, { stream: true })
 *
 * Custom 3-tier router preserved for initial agent selection.
 * Handoffs handled natively by the SDK.
 */

// Router exports
export {
  route,
  checkExplicitAgentRequest,
  keywordRoute,
  llmRoute,
  toOrchestrationRoutingDecision,
  ROUTABLE_AGENTS,
  RoutingDecisionSchema,
  type SDKRoutingDecision,
  type RoutableAgent,
  type RoutingSource,
  type RouteOptions,
  type ParsedRoutingDecision,
} from './router';

// Agent instances (@openai/agents SDK Agent class)
export {
  AgentTypeSchema,
  orchestratorAgent,
  coderAgent,
  researcherAgent,
  secretaryAgent,
  personalityAgent,
  homeAgent,
  financeAgent,
  imagegenAgent,
  getAgent,
  getAgentName,
  getHandoffTargets,
  isValidAgentType,
  getAllAgents,
  getAgentByName,
  getAgentType,
  type AgentType,
} from './agents';

// Runner exports (SDK-powered streaming)
export {
  streamMessage,
  type RunContext,
  type StreamMessageOptions,
} from './runner';
