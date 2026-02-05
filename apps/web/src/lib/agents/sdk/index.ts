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

// Handoff pattern exports
export {
  // Handoff creation functions
  createHandoffToAgent,
  handoffToCoder,
  handoffToResearcher,
  handoffToSecretary,
  handoffToPersonality,
  handoffToHome,
  handoffToFinance,
  handoffToImageGen,
  handoffToOrchestrator,
  // Handoff decision making
  decideHandoff,
  HANDOFF_CONFIDENCE_THRESHOLD,
  // Handoff execution
  executeHandoff,
  // Utility functions
  canHandoff,
  formatHandoffMessage,
  getHandoffTargetName,
  isHandoffTarget,
  getValidHandoffTargets,
  // Types
  type Handoff,
  type HandoffDecision,
  type HandoffResult,
  type CoderHandoffContext,
  type ResearcherHandoffContext,
  type SecretaryHandoffContext,
  type PersonalityHandoffContext,
  type HomeHandoffContext,
  type FinanceHandoffContext,
  type ImageGenHandoffContext,
} from './handoffs';

// Runner exports
export {
  // Main entry points
  streamMessage,
  runAgent,
  // Tool execution
  executeTool,
  // Utility functions
  toOpenAITools,
  buildSystemPrompt,
  // Types
  type RunContext,
  type ToolExecutionResult,
  type StreamMessageOptions,
} from './runner';

// These will be uncommented as files are created
// export * from './triage';
