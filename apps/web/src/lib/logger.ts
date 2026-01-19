/**
 * Structured Logger for Production Readiness
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - Structured JSON output for production
 * - Context injection (userId, requestId)
 * - Environment-aware (verbose in dev, structured in prod)
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info('User signed in', { userId: user.id });
 * logger.error('Failed to process request', { error: err, requestId });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

/**
 * Logger configuration based on environment
 * Uses process.env.NODE_ENV directly (replaced at build time)
 */
const config = {
  isDev: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  minLevel: (process.env.NODE_ENV === 'development' ? 'debug' : 'info') as LogLevel,
};

/**
 * Log level hierarchy for filtering
 */
const levelHierarchy: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output based on minimum level
 */
function shouldLog(level: LogLevel): boolean {
  if (config.isTest) return false;
  return levelHierarchy[level] >= levelHierarchy[config.minLevel];
}

/**
 * Format error objects for logging
 */
function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: config.isDev ? error.stack : undefined,
    };
  }
  return { value: String(error) };
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    // Process context to handle errors and circular references
    const processedContext: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Error) {
        processedContext[key] = formatError(value);
      } else {
        processedContext[key] = value;
      }
    }
    entry.context = processedContext;
  }

  return entry;
}

/**
 * Output a log entry based on environment
 */
function outputLog(entry: LogEntry): void {
  if (config.isDev) {
    // Development: Pretty printed console output
    const prefix = `[${entry.level.toUpperCase()}]`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context, null, 2)}`
      : '';

    switch (entry.level) {
      case 'debug':
        console.debug(`${timestamp} ${prefix} ${entry.message}${contextStr}`);
        break;
      case 'info':
        console.info(`${timestamp} ${prefix} ${entry.message}${contextStr}`);
        break;
      case 'warn':
        console.warn(`${timestamp} ${prefix} ${entry.message}${contextStr}`);
        break;
      case 'error':
        console.error(`${timestamp} ${prefix} ${entry.message}${contextStr}`);
        break;
    }
  } else {
    // Production: JSON structured output for log aggregators
    const output = JSON.stringify(entry);
    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}

/**
 * Create a log function for a specific level
 */
function createLogFunction(level: LogLevel) {
  return (message: string, context?: LogContext): void => {
    if (!shouldLog(level)) return;
    const entry = createLogEntry(level, message, context);
    outputLog(entry);
  };
}

/**
 * Structured logger instance
 */
export const logger = {
  debug: createLogFunction('debug'),
  info: createLogFunction('info'),
  warn: createLogFunction('warn'),
  error: createLogFunction('error'),

  /**
   * Create a child logger with bound context
   * Useful for request-scoped logging
   */
  child(boundContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...boundContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...boundContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...boundContext, ...context }),
      error: (message: string, context?: LogContext) =>
        logger.error(message, { ...boundContext, ...context }),
    };
  },
};

/**
 * Create a request-scoped logger
 * Automatically includes request metadata
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    ...(userId && { userId }),
  });
}

export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof logger.child>;
