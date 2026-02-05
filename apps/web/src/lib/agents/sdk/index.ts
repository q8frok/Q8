/**
 * OpenAI Agents SDK Implementation
 * Replaces MCP proxy architecture with direct API calls
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

// Agent configurations
export {
  AgentTypeSchema,
  agentConfigs,
  getAgentConfig,
  getAgentTools,
  getAgentModel,
  getAgentName,
  getHandoffTargets,
  isValidAgentType,
  getAllAgentConfigs,
  getAgentByName,
  type AgentType,
  type AgentConfig,
} from './agents';

// These will be uncommented as files are created
// export * from './triage';
// export * from './runner';
