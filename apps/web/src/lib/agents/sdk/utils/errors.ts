/**
 * Error classification and user-friendly messaging
 */

export interface ErrorClassification {
  code: string;
  recoverable: boolean;
}

/**
 * Classify an error for handling decisions
 */
export function classifyError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('timed out') || lowerMessage.includes('timeout')) {
    return { code: 'TIMEOUT', recoverable: true };
  }
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('failed to fetch') || lowerMessage.includes('connection refused')) {
    return { code: 'CONNECTION_ERROR', recoverable: true };
  }
  if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
    return { code: 'NOT_FOUND', recoverable: false };
  }
  if (lowerMessage.includes('401') || lowerMessage.includes('403') || lowerMessage.includes('unauthorized')) {
    return { code: 'AUTH_ERROR', recoverable: false };
  }
  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return { code: 'RATE_LIMITED', recoverable: true };
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return { code: 'VALIDATION_ERROR', recoverable: false };
  }

  return { code: 'UNKNOWN_ERROR', recoverable: false };
}

/**
 * Get a user-friendly error message for a tool failure
 */
export function getUserFriendlyError(toolName: string, _technicalError: string): string {
  const toolPrefix = toolName.split('_')[0]?.toLowerCase() ?? '';

  const friendlyMessages: Record<string, string> = {
    spotify: "I couldn't connect to Spotify. Make sure you have an active Spotify session on one of your devices.",
    github: "GitHub isn't responding right now. The API might be temporarily unavailable.",
    calendar: "I couldn't access your calendar. You may need to re-authorize Google access.",
    gmail: "I couldn't access your email. Please check your Google authorization.",
    drive: "Google Drive isn't accessible right now. Try re-authorizing if this persists.",
    youtube: "YouTube search isn't working. Please try again in a moment.",
    home: "Home Assistant isn't reachable. Check if your smart home hub is online.",
    control: "I couldn't control that device. Make sure Home Assistant is running.",
    weather: "Weather data isn't available right now. Please try again shortly.",
  };

  return (
    friendlyMessages[toolPrefix] ||
    `The ${toolName.replace(/_/g, ' ')} tool encountered an issue. Please try again.`
  );
}

/**
 * Get a recovery suggestion based on error type
 */
export function getRecoverySuggestion(toolName: string, error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('401') || lowerError.includes('403') || lowerError.includes('unauthorized')) {
    return 'Try re-authenticating or check your API credentials in settings.';
  }
  if (lowerError.includes('429') || lowerError.includes('rate limit')) {
    return 'You\'ve hit a rate limit. Please wait a moment and try again.';
  }
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'The service is responding slowly. Check your internet connection and try again.';
  }
  if (lowerError.includes('econnrefused') || lowerError.includes('connection')) {
    return 'Cannot reach the service. Check if the service is running and accessible.';
  }
  if (lowerError.includes('not found') || lowerError.includes('404')) {
    return 'The requested resource wasn\'t found. Double-check the details and try again.';
  }

  // Tool-specific suggestions
  if (toolName.startsWith('spotify')) {
    return 'Make sure Spotify is open on one of your devices.';
  }
  if (toolName.startsWith('home') || toolName.startsWith('control')) {
    return 'Check that Home Assistant is running and accessible on your network.';
  }

  return 'Please try again in a few moments. If the issue persists, check your settings.';
}

/**
 * Structured tool error result
 */
export interface ToolErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

/**
 * Create a structured tool error result
 */
export function createToolError(
  toolName: string,
  error: unknown,
  includeTechnical = false
): ToolErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const classification = classifyError(error);

  return {
    success: false,
    message: getUserFriendlyError(toolName, errorMessage),
    error: {
      code: classification.code,
      recoverable: classification.recoverable,
      suggestion: getRecoverySuggestion(toolName, errorMessage),
      ...(includeTechnical ? { technical: errorMessage } : {}),
    },
  };
}
