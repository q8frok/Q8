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
  if (lowerMessage.includes('api key') || lowerMessage.includes('missing_api_key') || lowerMessage.includes('not configured')) {
    return { code: 'MISSING_API_KEY', recoverable: false };
  }
  if (lowerMessage.includes('500') || lowerMessage.includes('internal server error')) {
    return { code: 'SERVER_ERROR', recoverable: true };
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
    ha: "Home Assistant isn't reachable. Check if your smart home hub is online.",
    control: "I couldn't control that device. Make sure Home Assistant is running.",
    discover: "I couldn't discover devices. Make sure Home Assistant is running.",
    weather: "Weather data isn't available right now. Please try again shortly.",
    getweather: "Weather data isn't available right now. Please try again shortly.",
    oura: "I couldn't fetch your Oura Ring data. Check that your Oura token is configured.",
    finance: "I couldn't access your financial data. Please check your finance integration settings.",
    generate: "Image generation encountered an issue. Please try again with a different prompt.",
    calculate: "The calculation couldn't be completed. Please check the expression and try again.",
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

  if (lowerError.includes('api key') || lowerError.includes('not configured') || lowerError.includes('missing_api_key')) {
    return 'This integration needs an API key. Check your settings to configure it.';
  }
  if (lowerError.includes('500') || lowerError.includes('internal server error')) {
    return 'The service had an internal error. Try again in a moment.';
  }

  // Tool-specific suggestions
  if (toolName.startsWith('spotify')) {
    return 'Make sure Spotify is open on one of your devices and you have an active session.';
  }
  if (toolName.startsWith('home') || toolName.startsWith('ha_') || toolName.startsWith('control') || toolName.startsWith('discover')) {
    return 'Check that Home Assistant is running and accessible on your network.';
  }
  if (toolName.startsWith('oura')) {
    return 'Check that your Oura Ring personal access token is configured in settings.';
  }
  if (toolName.startsWith('finance')) {
    return 'Check your finance integration settings and try again.';
  }
  if (toolName.startsWith('gmail') || toolName.startsWith('calendar') || toolName.startsWith('drive')) {
    return 'Try re-authorizing your Google account in settings.';
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
