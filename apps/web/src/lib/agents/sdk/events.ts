/**
 * Versioned event schema shared by runner, API route, and client parser.
 */

export const EVENT_SCHEMA_VERSION = 1;

export interface EventMetadata {
  eventVersion: number;
  runId: string;
  requestId: string;
  timestamp: string;
  correlationId?: string;
}

export type VersionedEvent<T extends { type: string }> = T & EventMetadata & Record<string, unknown>;

export interface EventTraceContext {
  runId: string;
  requestId: string;
  correlationId?: string;
}

export function withEventMetadata<T extends { type: string }>(
  event: T,
  trace: EventTraceContext,
): VersionedEvent<T> {
  return {
    ...event,
    eventVersion: EVENT_SCHEMA_VERSION,
    runId: trace.runId,
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    timestamp: new Date().toISOString(),
  };
}

export function hasSupportedEventVersion(event: { eventVersion?: unknown }): boolean {
  return event.eventVersion === EVENT_SCHEMA_VERSION;
}

