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

// These will be uncommented as files are created
// export * from './agents';
// export * from './triage';
// export * from './runner';
