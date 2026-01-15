/**
 * Observability Module
 * Telemetry, metrics, and evaluation harness
 */

// Telemetry
export {
  recordRoutingDecision,
  recordToolExecution,
  recordMemoryRetrieval,
  recordUserFeedback,
  recordError,
  flushTelemetry,
  telemetryCollector,
  type TelemetryEventType,
  type TelemetryEvent,
  type RoutingTelemetry,
  type ToolTelemetry,
  type MemoryTelemetry,
  type ResponseTelemetry,
  type FeedbackTelemetry,
  type ErrorTelemetry,
} from './telemetry';

// Eval harness
export {
  runEvalSuite,
  runMemoryPrecisionEval,
  formatEvalSummary,
  type EvalPrompt,
  type EvalCategory,
  type EvalResult,
  type EvalSummary,
  type EvalConfig,
} from './eval-harness';

// Eval suite
export {
  EVAL_SUITE,
  getPromptsByCategory,
  getPromptsBySubcategory,
  getRoutingPrompts,
  getMemoryPrompts,
  getToolPrompts,
} from './eval-suite';
