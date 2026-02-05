# AI Agents SDK Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace MCP proxy architecture with direct API calls and migrate to OpenAI Agents SDK for reliable, functioning AI agent interactions via chat UI.

**Architecture:** Triage agent (gpt-5-nano) routes to 7 specialized agents via native SDK handoffs. Each agent has direct API tools (no MCP servers). Structured outputs guarantee valid routing. Graceful error handling with user-friendly messages.

**Tech Stack:** OpenAI Agents SDK, Octokit (GitHub), googleapis, Plaid SDK, Spotify Web API, Home Assistant REST API, Zod (validation)

---

## Phase 1: Foundation - Direct API Tools

### Task 1.1: Create SDK Directory Structure

**Files:**
- Create: `apps/web/src/lib/agents/sdk/index.ts`
- Create: `apps/web/src/lib/agents/sdk/tools/index.ts`
- Create: `apps/web/src/lib/agents/sdk/utils/index.ts`

**Step 1: Create directory structure**

```bash
mkdir -p apps/web/src/lib/agents/sdk/tools
mkdir -p apps/web/src/lib/agents/sdk/utils
```

**Step 2: Create barrel exports**

Create `apps/web/src/lib/agents/sdk/index.ts`:
```typescript
/**
 * OpenAI Agents SDK Implementation
 * Replaces MCP proxy architecture with direct API calls
 */

export * from './agents';
export * from './triage';
export * from './runner';
export * from './router';
```

Create `apps/web/src/lib/agents/sdk/tools/index.ts`:
```typescript
/**
 * Direct API Tool Implementations
 * Each tool calls APIs directly without MCP proxy layer
 */

export * from './spotify';
export * from './github';
export * from './google';
export * from './home';
export * from './finance';
export * from './image';
export * from './default';
```

Create `apps/web/src/lib/agents/sdk/utils/index.ts`:
```typescript
/**
 * Utility functions for error handling and resilience
 */

export * from './preflight';
export * from './retry';
export * from './errors';
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/agents/sdk/
git commit -m "chore: create SDK directory structure for agents migration"
```

---

### Task 1.2: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install required packages**

```bash
cd apps/web
pnpm add @openai/agents @octokit/rest googleapis zod
```

**Step 2: Verify installation**

```bash
pnpm list @openai/agents @octokit/rest googleapis zod
```

Expected: All packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Agents SDK and direct API client dependencies"
```

---

### Task 1.3: Create Utility Functions - Retry Logic

**Files:**
- Create: `apps/web/src/lib/agents/sdk/utils/retry.ts`
- Create: `apps/web/tests/agents/sdk/utils/retry.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/utils/retry.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { executeWithRetry, isTransientError } from '@/lib/agents/sdk/utils/retry';

describe('isTransientError', () => {
  it('returns true for timeout errors', () => {
    expect(isTransientError(new Error('Request timed out'))).toBe(true);
  });

  it('returns true for 429 rate limit errors', () => {
    expect(isTransientError(new Error('Error 429: Too many requests'))).toBe(true);
  });

  it('returns false for 404 errors', () => {
    expect(isTransientError(new Error('Error 404: Not found'))).toBe(false);
  });

  it('returns false for auth errors', () => {
    expect(isTransientError(new Error('Error 401: Unauthorized'))).toBe(false);
  });
});

describe('executeWithRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await executeWithRetry(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await executeWithRetry(fn, { maxRetries: 3, backoffMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));

    await expect(executeWithRetry(fn, { maxRetries: 2, backoffMs: 10 }))
      .rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    await expect(executeWithRetry(fn, { maxRetries: 3 }))
      .rejects.toThrow('401 Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/retry.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/utils/retry.ts`:
```typescript
/**
 * Retry utilities with exponential backoff
 * Handles transient failures gracefully
 */

/**
 * Check if an error is transient (worth retrying)
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket hang up') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('too many requests')
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  retryOn?: (error: Error) => boolean;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    maxBackoffMs = 30000,
    retryOn = isTransientError,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-transient errors
      if (!retryOn(lastError)) {
        throw lastError;
      }

      // Don't sleep after last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          backoffMs * Math.pow(2, attempt) + Math.random() * 100,
          maxBackoffMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/retry.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/utils/retry.ts apps/web/tests/agents/sdk/utils/retry.test.ts
git commit -m "feat(agents): add retry utility with exponential backoff"
```

---

### Task 1.4: Create Utility Functions - Error Handling

**Files:**
- Create: `apps/web/src/lib/agents/sdk/utils/errors.ts`
- Create: `apps/web/tests/agents/sdk/utils/errors.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/utils/errors.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  classifyError,
  getUserFriendlyError,
  getRecoverySuggestion,
} from '@/lib/agents/sdk/utils/errors';

describe('classifyError', () => {
  it('classifies timeout errors', () => {
    const result = classifyError(new Error('Request timed out'));
    expect(result.code).toBe('TIMEOUT');
    expect(result.recoverable).toBe(true);
  });

  it('classifies auth errors', () => {
    const result = classifyError(new Error('401 Unauthorized'));
    expect(result.code).toBe('AUTH_ERROR');
    expect(result.recoverable).toBe(false);
  });

  it('classifies rate limit errors', () => {
    const result = classifyError(new Error('429 Too Many Requests'));
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.recoverable).toBe(true);
  });
});

describe('getUserFriendlyError', () => {
  it('returns friendly message for spotify tools', () => {
    const message = getUserFriendlyError('spotify_play', 'Connection refused');
    expect(message).toContain('Spotify');
    expect(message).not.toContain('Connection refused');
  });

  it('returns friendly message for github tools', () => {
    const message = getUserFriendlyError('github_get_pr', 'API error');
    expect(message).toContain('GitHub');
  });
});

describe('getRecoverySuggestion', () => {
  it('suggests re-auth for 401 errors', () => {
    const suggestion = getRecoverySuggestion('any_tool', '401 Unauthorized');
    expect(suggestion).toContain('authenticat');
  });

  it('suggests waiting for rate limits', () => {
    const suggestion = getRecoverySuggestion('any_tool', '429 rate limit');
    expect(suggestion).toContain('wait');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/errors.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/utils/errors.ts`:
```typescript
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
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('failed to fetch')) {
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
  const toolPrefix = toolName.split('_')[0]?.toLowerCase();

  const friendlyMessages: Record<string, string> = {
    spotify: "I couldn't connect to Spotify. Make sure you have an active Spotify session on one of your devices.",
    github: "GitHub isn't responding right now. The API might be temporarily unavailable.",
    calendar: "I couldn't access your calendar. You may need to re-authorize Google access.",
    gmail: "I couldn't access your email. Please check your Google authorization.",
    drive: "Google Drive isn't accessible right now. Try re-authorizing if this persists.",
    youtube: "YouTube search isn't working. Please try again in a moment.",
    home: "Home Assistant isn't reachable. Check if your smart home hub is online.",
    control: "I couldn't control that device. Make sure Home Assistant is running.",
    get_balance: "I couldn't fetch your account balance. Please check your banking connection.",
    get_spending: "I couldn't retrieve spending data. Try reconnecting your bank account.",
    generate: "Image generation failed. Please try again with a different prompt.",
    weather: "Weather data isn't available right now. Please try again shortly.",
  };

  return (
    friendlyMessages[toolPrefix] ||
    friendlyMessages[toolName] ||
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
 * Create a structured tool error result
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
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/errors.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/utils/errors.ts apps/web/tests/agents/sdk/utils/errors.test.ts
git commit -m "feat(agents): add error classification and user-friendly messages"
```

---

### Task 1.5: Create Utility Functions - Preflight Checks

**Files:**
- Create: `apps/web/src/lib/agents/sdk/utils/preflight.ts`
- Create: `apps/web/tests/agents/sdk/utils/preflight.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/utils/preflight.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkToolAvailability, type AgentType } from '@/lib/agents/sdk/utils/preflight';

describe('checkToolAvailability', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns available=true when all credentials present for personality', () => {
    process.env.SPOTIFY_REFRESH_TOKEN = 'test-token';
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const result = checkToolAvailability('personality');
    expect(result.available).toBe(true);
    expect(result.missingCredentials).toHaveLength(0);
  });

  it('returns available=false with missing credentials', () => {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const result = checkToolAvailability('personality');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('Spotify');
  });

  it('checks github credentials for coder agent', () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_test';

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/preflight.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/utils/preflight.ts`:
```typescript
/**
 * Pre-flight checks for tool availability
 * Validates credentials before attempting API calls
 */

export type AgentType =
  | 'orchestrator'
  | 'coder'
  | 'researcher'
  | 'secretary'
  | 'personality'
  | 'home'
  | 'finance'
  | 'imagegen';

interface CredentialCheck {
  envKey: string;
  name: string;
}

interface AvailabilityResult {
  available: boolean;
  missingCredentials: string[];
  degradedTools: string[];
}

/**
 * Credential requirements for each agent
 */
const AGENT_CREDENTIALS: Record<AgentType, CredentialCheck[]> = {
  orchestrator: [
    { envKey: 'OPENAI_API_KEY', name: 'OpenAI' },
  ],
  personality: [
    { envKey: 'SPOTIFY_REFRESH_TOKEN', name: 'Spotify' },
    { envKey: 'OPENWEATHER_API_KEY', name: 'Weather' },
  ],
  coder: [
    { envKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', name: 'GitHub' },
  ],
  researcher: [
    { envKey: 'PERPLEXITY_API_KEY', name: 'Perplexity' },
  ],
  secretary: [
    { envKey: 'GOOGLE_CLIENT_ID', name: 'Google Calendar' },
    { envKey: 'GOOGLE_CLIENT_SECRET', name: 'Google Auth' },
    { envKey: 'YOUTUBE_API_KEY', name: 'YouTube' },
  ],
  home: [
    { envKey: 'HASS_TOKEN', name: 'Home Assistant' },
    { envKey: 'HASS_URL', name: 'Home Assistant URL' },
  ],
  finance: [
    { envKey: 'PLAID_CLIENT_ID', name: 'Plaid Banking' },
    { envKey: 'PLAID_SECRET', name: 'Plaid Secret' },
  ],
  imagegen: [
    { envKey: 'OPENAI_API_KEY', name: 'OpenAI Images' },
  ],
};

/**
 * Check if all required credentials are available for an agent
 */
export function checkToolAvailability(agent: AgentType): AvailabilityResult {
  const required = AGENT_CREDENTIALS[agent] || [];
  const missing: string[] = [];
  const degraded: string[] = [];

  for (const check of required) {
    const value = process.env[check.envKey];
    if (!value || value.trim() === '' || value === 'placeholder') {
      missing.push(check.name);
      degraded.push(check.name);
    }
  }

  return {
    available: missing.length === 0,
    missingCredentials: missing,
    degradedTools: degraded,
  };
}

/**
 * Check availability for all agents
 */
export function checkAllAgentsAvailability(): Record<AgentType, AvailabilityResult> {
  const agents: AgentType[] = [
    'orchestrator',
    'coder',
    'researcher',
    'secretary',
    'personality',
    'home',
    'finance',
    'imagegen',
  ];

  const results: Record<string, AvailabilityResult> = {};
  for (const agent of agents) {
    results[agent] = checkToolAvailability(agent);
  }

  return results as Record<AgentType, AvailabilityResult>;
}

/**
 * Get a summary of which tools are available
 */
export function getAvailabilityReport(): string {
  const results = checkAllAgentsAvailability();
  const lines: string[] = ['Agent Tool Availability:'];

  for (const [agent, result] of Object.entries(results)) {
    const status = result.available ? '✓' : '✗';
    const missing = result.missingCredentials.length > 0
      ? ` (missing: ${result.missingCredentials.join(', ')})`
      : '';
    lines.push(`  ${status} ${agent}${missing}`);
  }

  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/utils/preflight.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/utils/preflight.ts apps/web/tests/agents/sdk/utils/preflight.test.ts
git commit -m "feat(agents): add preflight credential checks for tools"
```

---

### Task 1.6: Implement Default Tools (datetime, weather, calculate)

**Files:**
- Create: `apps/web/src/lib/agents/sdk/tools/default.ts`
- Create: `apps/web/tests/agents/sdk/tools/default.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/tools/default.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrentDatetime,
  calculate,
  getWeather,
  defaultTools,
} from '@/lib/agents/sdk/tools/default';

describe('getCurrentDatetime', () => {
  it('returns current date and time info', async () => {
    const result = await getCurrentDatetime({ timezone: 'America/New_York' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('iso');
    expect(result.data).toHaveProperty('timezone');
    expect(result.data).toHaveProperty('dayOfWeek');
  });

  it('uses UTC as default timezone', async () => {
    const result = await getCurrentDatetime({});
    expect(result.success).toBe(true);
    expect(result.data.timezone).toBe('UTC');
  });
});

describe('calculate', () => {
  it('evaluates simple math expressions', async () => {
    const result = await calculate({ expression: '2 + 2' });
    expect(result.success).toBe(true);
    expect(result.data.result).toBe(4);
  });

  it('handles complex expressions', async () => {
    const result = await calculate({ expression: 'sqrt(16) * 2' });
    expect(result.success).toBe(true);
    expect(result.data.result).toBe(8);
  });

  it('returns error for invalid expressions', async () => {
    const result = await calculate({ expression: 'invalid syntax @@' });
    expect(result.success).toBe(false);
  });
});

describe('defaultTools', () => {
  it('exports tool definitions array', () => {
    expect(Array.isArray(defaultTools)).toBe(true);
    expect(defaultTools.length).toBeGreaterThan(0);

    const toolNames = defaultTools.map(t => t.function.name);
    expect(toolNames).toContain('get_current_datetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('get_weather');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/default.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/tools/default.ts`:
```typescript
/**
 * Default Tools - Available to all agents
 * datetime, weather, calculate
 */

import { create, all } from 'mathjs';
import { executeWithRetry } from '../utils/retry';
import { createToolError } from '../utils/errors';

const math = create(all);

// Tool result type
interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    recoverable: boolean;
    suggestion: string;
  };
}

/**
 * Get current datetime with timezone support
 */
export async function getCurrentDatetime(args: {
  timezone?: string;
}): Promise<ToolResult<{
  iso: string;
  formatted: string;
  timezone: string;
  dayOfWeek: string;
  date: string;
  time: string;
}>> {
  try {
    const timezone = args.timezone || 'UTC';
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });

    return {
      success: true,
      data: {
        iso: now.toISOString(),
        formatted: formatter.format(now),
        timezone,
        dayOfWeek: dayFormatter.format(now),
        date: dateFormatter.format(now),
        time: timeFormatter.format(now),
      },
    };
  } catch (error) {
    return createToolError('get_current_datetime', error);
  }
}

/**
 * Calculate math expressions using mathjs
 */
export async function calculate(args: {
  expression: string;
}): Promise<ToolResult<{ expression: string; result: number | string }>> {
  try {
    const { expression } = args;
    const result = math.evaluate(expression);

    return {
      success: true,
      data: {
        expression,
        result: typeof result === 'object' ? math.format(result) : result,
      },
    };
  } catch (error) {
    return createToolError('calculate', error);
  }
}

/**
 * Get weather for a location using OpenWeather API
 */
export async function getWeather(args: {
  location: string;
  units?: 'metric' | 'imperial';
}): Promise<ToolResult<{
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  units: string;
}>> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      message: 'Weather service is not configured.',
      error: {
        code: 'MISSING_CREDENTIAL',
        recoverable: false,
        suggestion: 'Add OPENWEATHER_API_KEY to your environment variables.',
      },
    };
  }

  try {
    const { location, units = 'imperial' } = args;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;

    const response = await executeWithRetry(
      () => fetch(url).then(r => {
        if (!r.ok) throw new Error(`Weather API error: ${r.status}`);
        return r.json();
      }),
      { maxRetries: 2, backoffMs: 500 }
    );

    return {
      success: true,
      data: {
        location: response.name,
        temperature: Math.round(response.main.temp),
        feelsLike: Math.round(response.main.feels_like),
        humidity: response.main.humidity,
        description: response.weather[0]?.description || 'Unknown',
        units: units === 'metric' ? 'Celsius' : 'Fahrenheit',
      },
    };
  } catch (error) {
    return createToolError('get_weather', error);
  }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const defaultTools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_current_datetime',
      description: 'Get the current date and time, optionally in a specific timezone',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'IANA timezone name (e.g., "America/New_York", "Europe/London"). Defaults to UTC.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate',
      description: 'Evaluate a mathematical expression. Supports basic operations, functions (sqrt, sin, cos, log), and unit conversions.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The math expression to evaluate (e.g., "2 + 2", "sqrt(16) * 2", "5 inches to cm")',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get current weather conditions for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name or location (e.g., "New York", "London, UK")',
          },
          units: {
            type: 'string',
            enum: ['metric', 'imperial'],
            description: 'Temperature units. "metric" for Celsius, "imperial" for Fahrenheit. Defaults to imperial.',
          },
        },
        required: ['location'],
      },
    },
  },
];

/**
 * Execute a default tool by name
 */
export async function executeDefaultTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_current_datetime':
      return getCurrentDatetime(args as { timezone?: string });
    case 'calculate':
      return calculate(args as { expression: string });
    case 'get_weather':
      return getWeather(args as { location: string; units?: 'metric' | 'imperial' });
    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
        error: {
          code: 'UNKNOWN_TOOL',
          recoverable: false,
          suggestion: 'This tool is not available.',
        },
      };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/default.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/tools/default.ts apps/web/tests/agents/sdk/tools/default.test.ts
git commit -m "feat(agents): implement default tools (datetime, weather, calculate)"
```

---

### Task 1.7: Implement Spotify Direct API Tools

**Files:**
- Create: `apps/web/src/lib/agents/sdk/tools/spotify.ts`
- Create: `apps/web/tests/agents/sdk/tools/spotify.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/tools/spotify.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken, spotifyTools } from '@/lib/agents/sdk/tools/spotify';

// Mock fetch
global.fetch = vi.fn();

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
    process.env.SPOTIFY_REFRESH_TOKEN = 'test-refresh-token';
  });

  it('fetches and returns access token', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access-token', expires_in: 3600 }),
    });

    const token = await getAccessToken();
    expect(token).toBe('new-access-token');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when credentials missing', async () => {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    await expect(getAccessToken()).rejects.toThrow('Spotify credentials not configured');
  });
});

describe('spotifyTools', () => {
  it('exports tool definitions array', () => {
    expect(Array.isArray(spotifyTools)).toBe(true);

    const toolNames = spotifyTools.map(t => t.function.name);
    expect(toolNames).toContain('spotify_search');
    expect(toolNames).toContain('spotify_now_playing');
    expect(toolNames).toContain('spotify_play_pause');
    expect(toolNames).toContain('spotify_next_previous');
    expect(toolNames).toContain('spotify_set_volume');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/spotify.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/tools/spotify.ts`:
```typescript
/**
 * Spotify Direct API Tools
 * Replaces MCP proxy with direct Spotify Web API calls
 */

import { executeWithRetry } from '../utils/retry';
import { createToolError } from '../utils/errors';
import { logger } from '@/lib/logger';

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get Spotify access token, refreshing if needed
 */
export async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Spotify credentials not configured');
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

/**
 * Make authenticated Spotify API request
 */
async function spotifyRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const response = await executeWithRetry(
    async () => {
      const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Spotify API error ${res.status}: ${error}`);
      }

      // Handle empty responses (204 No Content)
      if (res.status === 204) {
        return {} as T;
      }

      return res.json();
    },
    { maxRetries: 2, backoffMs: 500 }
  );

  return response;
}

// Tool result type
interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    recoverable: boolean;
    suggestion: string;
  };
}

/**
 * Search Spotify for tracks, albums, artists, or playlists
 */
export async function searchSpotify(args: {
  query: string;
  type?: 'track' | 'album' | 'artist' | 'playlist';
  limit?: number;
}): Promise<ToolResult> {
  try {
    const { query, type = 'track', limit = 10 } = args;
    const params = new URLSearchParams({
      q: query,
      type,
      limit: limit.toString(),
    });

    const data = await spotifyRequest<{
      tracks?: { items: Array<{ name: string; artists: Array<{ name: string }>; uri: string; album: { name: string } }> };
      albums?: { items: Array<{ name: string; artists: Array<{ name: string }>; uri: string }> };
      artists?: { items: Array<{ name: string; uri: string; genres: string[] }> };
      playlists?: { items: Array<{ name: string; uri: string; owner: { display_name: string } }> };
    }>(`/search?${params}`);

    const items = data.tracks?.items || data.albums?.items || data.artists?.items || data.playlists?.items || [];

    return {
      success: true,
      data: {
        type,
        results: items.slice(0, limit).map((item) => ({
          name: item.name,
          uri: item.uri,
          artist: 'artists' in item ? item.artists?.[0]?.name : undefined,
          album: 'album' in item ? item.album?.name : undefined,
        })),
      },
    };
  } catch (error) {
    logger.error('Spotify search failed', { error });
    return createToolError('spotify_search', error);
  }
}

/**
 * Get currently playing track
 */
export async function getNowPlaying(): Promise<ToolResult> {
  try {
    const data = await spotifyRequest<{
      is_playing: boolean;
      item?: {
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; images: Array<{ url: string }> };
        duration_ms: number;
      };
      progress_ms?: number;
      device?: { name: string; volume_percent: number };
    }>('/me/player/currently-playing');

    if (!data.item) {
      return {
        success: true,
        data: { playing: false, message: 'Nothing is currently playing' },
      };
    }

    return {
      success: true,
      data: {
        playing: data.is_playing,
        track: data.item.name,
        artist: data.item.artists.map(a => a.name).join(', '),
        album: data.item.album.name,
        albumArt: data.item.album.images[0]?.url,
        progress: data.progress_ms,
        duration: data.item.duration_ms,
        device: data.device?.name,
        volume: data.device?.volume_percent,
      },
    };
  } catch (error) {
    logger.error('Spotify now playing failed', { error });
    return createToolError('spotify_now_playing', error);
  }
}

/**
 * Control playback (play, pause, toggle)
 */
export async function controlPlayback(args: {
  action?: 'play' | 'pause' | 'toggle';
  uri?: string;
  deviceId?: string;
}): Promise<ToolResult> {
  try {
    const { action = 'toggle', uri, deviceId } = args;

    // Get current state for toggle
    let shouldPlay = action === 'play';
    if (action === 'toggle') {
      const current = await spotifyRequest<{ is_playing: boolean }>('/me/player');
      shouldPlay = !current.is_playing;
    }

    const endpoint = shouldPlay ? '/me/player/play' : '/me/player/pause';
    const params = deviceId ? `?device_id=${deviceId}` : '';

    const body = shouldPlay && uri ? JSON.stringify({ uris: [uri] }) : undefined;

    await spotifyRequest(endpoint + params, {
      method: 'PUT',
      body,
    });

    return {
      success: true,
      data: { action: shouldPlay ? 'playing' : 'paused' },
      message: shouldPlay ? 'Started playback' : 'Paused playback',
    };
  } catch (error) {
    logger.error('Spotify playback control failed', { error });
    return createToolError('spotify_play_pause', error);
  }
}

/**
 * Skip to next or previous track
 */
export async function skipTrack(args: {
  direction: 'next' | 'previous';
  deviceId?: string;
}): Promise<ToolResult> {
  try {
    const { direction, deviceId } = args;
    const endpoint = `/me/player/${direction}`;
    const params = deviceId ? `?device_id=${deviceId}` : '';

    await spotifyRequest(endpoint + params, { method: 'POST' });

    return {
      success: true,
      data: { action: direction },
      message: `Skipped to ${direction} track`,
    };
  } catch (error) {
    logger.error('Spotify skip failed', { error });
    return createToolError('spotify_next_previous', error);
  }
}

/**
 * Add track to queue
 */
export async function addToQueue(args: {
  uri: string;
  deviceId?: string;
}): Promise<ToolResult> {
  try {
    const { uri, deviceId } = args;
    const params = new URLSearchParams({ uri });
    if (deviceId) params.append('device_id', deviceId);

    await spotifyRequest(`/me/player/queue?${params}`, { method: 'POST' });

    return {
      success: true,
      message: 'Added to queue',
    };
  } catch (error) {
    logger.error('Spotify add to queue failed', { error });
    return createToolError('spotify_add_to_queue', error);
  }
}

/**
 * Get available playback devices
 */
export async function getDevices(): Promise<ToolResult> {
  try {
    const data = await spotifyRequest<{
      devices: Array<{
        id: string;
        name: string;
        type: string;
        is_active: boolean;
        volume_percent: number;
      }>;
    }>('/me/player/devices');

    return {
      success: true,
      data: {
        devices: data.devices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          active: d.is_active,
          volume: d.volume_percent,
        })),
      },
    };
  } catch (error) {
    logger.error('Spotify get devices failed', { error });
    return createToolError('spotify_get_devices', error);
  }
}

/**
 * Set playback volume
 */
export async function setVolume(args: {
  volume: number;
  deviceId?: string;
}): Promise<ToolResult> {
  try {
    const { volume, deviceId } = args;
    const clampedVolume = Math.max(0, Math.min(100, Math.round(volume)));

    const params = new URLSearchParams({ volume_percent: clampedVolume.toString() });
    if (deviceId) params.append('device_id', deviceId);

    await spotifyRequest(`/me/player/volume?${params}`, { method: 'PUT' });

    return {
      success: true,
      data: { volume: clampedVolume },
      message: `Volume set to ${clampedVolume}%`,
    };
  } catch (error) {
    logger.error('Spotify set volume failed', { error });
    return createToolError('spotify_set_volume', error);
  }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const spotifyTools = [
  {
    type: 'function' as const,
    function: {
      name: 'spotify_search',
      description: 'Search Spotify for tracks, albums, artists, or playlists',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "Bohemian Rhapsody", "Taylor Swift", "jazz playlist")',
          },
          type: {
            type: 'string',
            enum: ['track', 'album', 'artist', 'playlist'],
            description: 'Type of content to search for. Defaults to track.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (1-50). Defaults to 10.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_now_playing',
      description: 'Get information about the currently playing track on Spotify',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_play_pause',
      description: 'Control Spotify playback - play, pause, or toggle. Can also play a specific track by URI.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['play', 'pause', 'toggle'],
            description: 'Playback action. Defaults to toggle.',
          },
          uri: {
            type: 'string',
            description: 'Spotify URI to play (e.g., "spotify:track:xxx"). Optional.',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID. Uses active device if not specified.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_next_previous',
      description: 'Skip to the next or previous track',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['next', 'previous'],
            description: 'Skip direction',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID. Uses active device if not specified.',
          },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_add_to_queue',
      description: 'Add a track to the playback queue',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Spotify track URI to add (e.g., "spotify:track:xxx")',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID. Uses active device if not specified.',
          },
        },
        required: ['uri'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_get_devices',
      description: 'Get list of available Spotify playback devices',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spotify_set_volume',
      description: 'Set the playback volume (0-100)',
      parameters: {
        type: 'object',
        properties: {
          volume: {
            type: 'number',
            description: 'Volume level (0-100)',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID. Uses active device if not specified.',
          },
        },
        required: ['volume'],
      },
    },
  },
];

/**
 * Execute a Spotify tool by name
 */
export async function executeSpotifyTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case 'spotify_search':
      return searchSpotify(args as Parameters<typeof searchSpotify>[0]);
    case 'spotify_now_playing':
      return getNowPlaying();
    case 'spotify_play_pause':
      return controlPlayback(args as Parameters<typeof controlPlayback>[0]);
    case 'spotify_next_previous':
      return skipTrack(args as Parameters<typeof skipTrack>[0]);
    case 'spotify_add_to_queue':
      return addToQueue(args as Parameters<typeof addToQueue>[0]);
    case 'spotify_get_devices':
      return getDevices();
    case 'spotify_set_volume':
      return setVolume(args as Parameters<typeof setVolume>[0]);
    default:
      return createToolError(toolName, new Error(`Unknown Spotify tool: ${toolName}`));
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/spotify.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/tools/spotify.ts apps/web/tests/agents/sdk/tools/spotify.test.ts
git commit -m "feat(agents): implement Spotify direct API tools"
```

---

### Task 1.8: Implement GitHub Direct API Tools

**Files:**
- Create: `apps/web/src/lib/agents/sdk/tools/github.ts`
- Create: `apps/web/tests/agents/sdk/tools/github.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/tools/github.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubTools, createOctokitClient } from '@/lib/agents/sdk/tools/github';

describe('createOctokitClient', () => {
  beforeEach(() => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_test_token';
  });

  it('creates client with auth token', () => {
    const client = createOctokitClient();
    expect(client).toBeDefined();
  });

  it('throws when token missing', () => {
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    expect(() => createOctokitClient()).toThrow('GitHub token not configured');
  });
});

describe('githubTools', () => {
  it('exports tool definitions array', () => {
    expect(Array.isArray(githubTools)).toBe(true);

    const toolNames = githubTools.map(t => t.function.name);
    expect(toolNames).toContain('github_search_code');
    expect(toolNames).toContain('github_get_file');
    expect(toolNames).toContain('github_list_prs');
    expect(toolNames).toContain('github_create_issue');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/github.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/tools/github.ts`:
```typescript
/**
 * GitHub Direct API Tools
 * Uses Octokit for type-safe GitHub REST API access
 */

import { Octokit } from '@octokit/rest';
import { executeWithRetry } from '../utils/retry';
import { createToolError } from '../utils/errors';
import { logger } from '@/lib/logger';

// Tool result type
interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    recoverable: boolean;
    suggestion: string;
  };
}

/**
 * Create authenticated Octokit client
 */
export function createOctokitClient(): Octokit {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  if (!token) {
    throw new Error('GitHub token not configured');
  }

  return new Octokit({ auth: token });
}

/**
 * Search code in repositories
 */
export async function searchCode(args: {
  query: string;
  repo?: string;
  language?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { query, repo, language, limit = 10 } = args;

    let q = query;
    if (repo) q += ` repo:${repo}`;
    if (language) q += ` language:${language}`;

    const response = await executeWithRetry(
      () => octokit.search.code({ q, per_page: limit }),
      { maxRetries: 2 }
    );

    return {
      success: true,
      data: {
        totalCount: response.data.total_count,
        items: response.data.items.map(item => ({
          name: item.name,
          path: item.path,
          repository: item.repository.full_name,
          url: item.html_url,
          sha: item.sha,
        })),
      },
    };
  } catch (error) {
    logger.error('GitHub code search failed', { error });
    return createToolError('github_search_code', error);
  }
}

/**
 * Get file contents from a repository
 */
export async function getFileContent(args: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { owner, repo, path, ref } = args;

    const response = await executeWithRetry(
      () => octokit.repos.getContent({ owner, repo, path, ref }),
      { maxRetries: 2 }
    );

    const data = response.data;

    if (Array.isArray(data)) {
      // Directory listing
      return {
        success: true,
        data: {
          type: 'directory',
          items: data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
          })),
        },
      };
    }

    if ('content' in data && data.type === 'file') {
      // File content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        success: true,
        data: {
          type: 'file',
          path: data.path,
          content,
          size: data.size,
          sha: data.sha,
        },
      };
    }

    return {
      success: false,
      message: 'Unsupported content type',
    };
  } catch (error) {
    logger.error('GitHub get file failed', { error });
    return createToolError('github_get_file', error);
  }
}

/**
 * List pull requests
 */
export async function listPullRequests(args: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  limit?: number;
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { owner, repo, state = 'open', limit = 10 } = args;

    const response = await executeWithRetry(
      () => octokit.pulls.list({ owner, repo, state, per_page: limit }),
      { maxRetries: 2 }
    );

    return {
      success: true,
      data: {
        pullRequests: response.data.map(pr => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user?.login,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          url: pr.html_url,
          draft: pr.draft,
          mergeable: pr.mergeable,
        })),
      },
    };
  } catch (error) {
    logger.error('GitHub list PRs failed', { error });
    return createToolError('github_list_prs', error);
  }
}

/**
 * Get pull request details
 */
export async function getPullRequest(args: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { owner, repo, pullNumber } = args;

    const [prResponse, filesResponse] = await Promise.all([
      executeWithRetry(() => octokit.pulls.get({ owner, repo, pull_number: pullNumber })),
      executeWithRetry(() => octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber })),
    ]);

    const pr = prResponse.data;
    const files = filesResponse.data;

    return {
      success: true,
      data: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author: pr.user?.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        files: files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })),
      },
    };
  } catch (error) {
    logger.error('GitHub get PR failed', { error });
    return createToolError('github_get_pr', error);
  }
}

/**
 * Create an issue
 */
export async function createIssue(args: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { owner, repo, title, body, labels } = args;

    const response = await executeWithRetry(
      () => octokit.issues.create({ owner, repo, title, body, labels }),
      { maxRetries: 2 }
    );

    return {
      success: true,
      data: {
        number: response.data.number,
        title: response.data.title,
        url: response.data.html_url,
        state: response.data.state,
      },
      message: `Created issue #${response.data.number}`,
    };
  } catch (error) {
    logger.error('GitHub create issue failed', { error });
    return createToolError('github_create_issue', error);
  }
}

/**
 * List issues
 */
export async function listIssues(args: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    const octokit = createOctokitClient();
    const { owner, repo, state = 'open', labels, limit = 10 } = args;

    const response = await executeWithRetry(
      () => octokit.issues.listForRepo({ owner, repo, state, labels, per_page: limit }),
      { maxRetries: 2 }
    );

    // Filter out pull requests (they appear in issues API)
    const issues = response.data.filter(issue => !issue.pull_request);

    return {
      success: true,
      data: {
        issues: issues.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user?.login,
          labels: issue.labels.map(l => (typeof l === 'string' ? l : l.name)),
          createdAt: issue.created_at,
          url: issue.html_url,
        })),
      },
    };
  } catch (error) {
    logger.error('GitHub list issues failed', { error });
    return createToolError('github_list_issues', error);
  }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const githubTools = [
  {
    type: 'function' as const,
    function: {
      name: 'github_search_code',
      description: 'Search for code in GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "useState hook", "async function")',
          },
          repo: {
            type: 'string',
            description: 'Limit search to a specific repo (e.g., "owner/repo")',
          },
          language: {
            type: 'string',
            description: 'Filter by programming language (e.g., "typescript", "python")',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github_get_file',
      description: 'Get the contents of a file from a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          path: {
            type: 'string',
            description: 'Path to file (e.g., "src/index.ts")',
          },
          ref: {
            type: 'string',
            description: 'Branch, tag, or commit SHA (default: default branch)',
          },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github_list_prs',
      description: 'List pull requests in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'PR state filter (default: open)',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github_get_pr',
      description: 'Get details of a specific pull request including changed files',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github_create_issue',
      description: 'Create a new issue in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue description (markdown supported)',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to apply',
          },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github_list_issues',
      description: 'List issues in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Issue state filter (default: open)',
          },
          labels: {
            type: 'string',
            description: 'Comma-separated list of label names',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
];

/**
 * Execute a GitHub tool by name
 */
export async function executeGithubTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case 'github_search_code':
      return searchCode(args as Parameters<typeof searchCode>[0]);
    case 'github_get_file':
      return getFileContent(args as Parameters<typeof getFileContent>[0]);
    case 'github_list_prs':
      return listPullRequests(args as Parameters<typeof listPullRequests>[0]);
    case 'github_get_pr':
      return getPullRequest(args as Parameters<typeof getPullRequest>[0]);
    case 'github_create_issue':
      return createIssue(args as Parameters<typeof createIssue>[0]);
    case 'github_list_issues':
      return listIssues(args as Parameters<typeof listIssues>[0]);
    default:
      return createToolError(toolName, new Error(`Unknown GitHub tool: ${toolName}`));
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/tools/github.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/tools/github.ts apps/web/tests/agents/sdk/tools/github.test.ts
git commit -m "feat(agents): implement GitHub direct API tools with Octokit"
```

---

## Phase 2: Routing Upgrade

### Task 2.1: Implement gpt-5-nano Router with Structured Outputs

**Files:**
- Create: `apps/web/src/lib/agents/sdk/router.ts`
- Create: `apps/web/tests/agents/sdk/router.test.ts`

**Step 1: Write the failing test**

Create `apps/web/tests/agents/sdk/router.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeMessage, RoutingDecisionSchema, heuristicRoute } from '@/lib/agents/sdk/router';

describe('heuristicRoute', () => {
  it('routes music queries to personality', () => {
    const result = heuristicRoute('play some jazz music');
    expect(result.agent).toBe('personality');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('routes code queries to coder', () => {
    const result = heuristicRoute('fix the bug in the login function');
    expect(result.agent).toBe('coder');
  });

  it('routes calendar queries to secretary', () => {
    const result = heuristicRoute('what meetings do I have tomorrow');
    expect(result.agent).toBe('secretary');
  });

  it('routes home automation to home', () => {
    const result = heuristicRoute('turn off the living room lights');
    expect(result.agent).toBe('home');
  });

  it('routes finance queries to finance', () => {
    const result = heuristicRoute('what is my account balance');
    expect(result.agent).toBe('finance');
  });

  it('defaults to personality for ambiguous queries', () => {
    const result = heuristicRoute('hello how are you');
    expect(result.agent).toBe('personality');
  });
});

describe('RoutingDecisionSchema', () => {
  it('validates correct routing decision', () => {
    const decision = {
      agent: 'coder',
      confidence: 0.95,
      rationale: 'Code-related query',
    };

    const result = RoutingDecisionSchema.safeParse(decision);
    expect(result.success).toBe(true);
  });

  it('rejects invalid agent', () => {
    const decision = {
      agent: 'invalid_agent',
      confidence: 0.5,
      rationale: 'Test',
    };

    const result = RoutingDecisionSchema.safeParse(decision);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- apps/web/tests/agents/sdk/router.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `apps/web/src/lib/agents/sdk/router.ts`:
```typescript
/**
 * Intelligent Router with gpt-5-nano + Structured Outputs
 * Fast, cheap, accurate agent selection
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { logger } from '@/lib/logger';

/**
 * Valid agent types
 */
export const AgentTypeSchema = z.enum([
  'coder',
  'researcher',
  'secretary',
  'home',
  'finance',
  'imagegen',
  'personality',
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

/**
 * Routing decision schema for structured outputs
 */
export const RoutingDecisionSchema = z.object({
  agent: AgentTypeSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  suggestedTools: z.array(z.string()).optional(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * System prompt for the router
 */
const ROUTING_SYSTEM_PROMPT = `You are a routing classifier for Q8, a multi-agent AI assistant.
Analyze the user's message and select the most appropriate specialist agent.

## Available Agents:

1. **coder** - DevBot (Claude Opus 4.5)
   - Code review, debugging, GitHub PRs/issues
   - SQL queries, database operations
   - Programming questions, architecture advice

2. **researcher** - ResearchBot (Perplexity Sonar)
   - Web search, real-time information
   - News, current events, fact-checking
   - Documentation lookup, research questions

3. **secretary** - SecretaryBot (Gemini 3 Flash)
   - Email (Gmail), calendar, meetings
   - Google Drive file search
   - YouTube video search
   - Scheduling, reminders

4. **home** - HomeBot (GPT-5-mini)
   - Smart home control (lights, thermostat, locks)
   - Home Assistant devices and scenes
   - Climate control, security

5. **finance** - FinanceBot (Gemini 3 Flash)
   - Bank account balances, transactions
   - Spending analysis, budgeting
   - Investment portfolio, bills

6. **imagegen** - ImageGen (GPT-5-mini + gpt-image-1.5)
   - Generate images from text prompts
   - Create diagrams, charts, flowcharts
   - Analyze or edit images

7. **personality** - Q8 (Grok 4.1 Fast)
   - General conversation, casual chat
   - Music control (Spotify playback)
   - Weather queries
   - Creative writing, jokes, opinions
   - Default fallback for unclear requests

## Routing Rules:

1. Music/Spotify → personality (has Spotify tools)
2. Weather → personality (has weather tools)
3. "Search the web" / "look up" / "what's the latest" → researcher
4. "Search code" / "find in codebase" → coder
5. Email/calendar/meetings → secretary
6. YouTube videos → secretary
7. Lights/thermostat/home devices → home
8. Money/budget/spending/bank → finance
9. Generate/create image/diagram → imagegen
10. General chat, greetings, opinions → personality

When uncertain, choose personality - it's the safest fallback.`;

/**
 * Heuristic keyword-based routing (fallback)
 */
export function heuristicRoute(message: string): RoutingDecision {
  const lower = message.toLowerCase();

  // Define keyword patterns with weights
  const patterns: Array<{
    agent: AgentType;
    phrases: string[];  // 3 points each
    words: string[];    // 1 point each
  }> = [
    {
      agent: 'coder',
      phrases: ['fix the bug', 'code review', 'pull request', 'git commit', 'debug this'],
      words: ['code', 'bug', 'debug', 'github', 'function', 'class', 'error', 'sql', 'api', 'commit', 'pr', 'merge'],
    },
    {
      agent: 'researcher',
      phrases: ['search for', 'look up', 'find information', 'what is the latest', 'research'],
      words: ['search', 'research', 'news', 'latest', 'article', 'source', 'find'],
    },
    {
      agent: 'secretary',
      phrases: ['send email', 'check my calendar', 'schedule a meeting', 'youtube video', 'google drive'],
      words: ['email', 'calendar', 'meeting', 'schedule', 'gmail', 'drive', 'youtube', 'appointment'],
    },
    {
      agent: 'home',
      phrases: ['turn on the', 'turn off the', 'set temperature', 'smart home'],
      words: ['light', 'lights', 'lamp', 'thermostat', 'temperature', 'lock', 'door', 'blinds', 'scene', 'hvac'],
    },
    {
      agent: 'finance',
      phrases: ['account balance', 'how much money', 'spending summary', 'can i afford'],
      words: ['money', 'budget', 'spending', 'balance', 'bank', 'investment', 'bill', 'payment', 'finance'],
    },
    {
      agent: 'imagegen',
      phrases: ['generate an image', 'create a diagram', 'make a chart', 'draw a picture'],
      words: ['image', 'picture', 'diagram', 'chart', 'generate', 'visualize', 'draw', 'illustration'],
    },
    {
      agent: 'personality',
      phrases: ['play some music', 'what is playing', 'how are you', 'tell me a joke'],
      words: ['music', 'song', 'spotify', 'play', 'playlist', 'weather', 'hello', 'hi', 'thanks', 'joke'],
    },
  ];

  let bestMatch: { agent: AgentType; score: number; matches: string[] } | null = null;

  for (const pattern of patterns) {
    let score = 0;
    const matches: string[] = [];

    // Check phrases (3 points each)
    for (const phrase of pattern.phrases) {
      if (lower.includes(phrase)) {
        score += 3;
        matches.push(phrase);
      }
    }

    // Check words (1 point each)
    for (const word of pattern.words) {
      if (lower.includes(word)) {
        score += 1;
        matches.push(word);
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { agent: pattern.agent, score, matches };
    }
  }

  // Default to personality if no strong match
  if (!bestMatch || bestMatch.score < 2) {
    return {
      agent: 'personality',
      confidence: 0.5,
      rationale: 'No specific domain detected, using general assistant',
    };
  }

  // Calculate confidence based on score
  const confidence = Math.min(0.95, 0.5 + bestMatch.score * 0.1);

  return {
    agent: bestMatch.agent,
    confidence,
    rationale: `Matched keywords: ${bestMatch.matches.slice(0, 3).join(', ')}`,
  };
}

/**
 * LLM-based routing with gpt-5-nano and structured outputs
 */
export async function llmRoute(message: string): Promise<RoutingDecision> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const completion = await client.beta.chat.completions.parse({
      model: 'gpt-5-nano', // Fast, cheap, great for classification
      messages: [
        { role: 'system', content: ROUTING_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      response_format: zodResponseFormat(RoutingDecisionSchema, 'routing_decision'),
      max_tokens: 150,
      temperature: 0, // Deterministic for consistency
    });

    const decision = completion.choices[0]?.message.parsed;

    if (!decision) {
      throw new Error('Failed to parse routing decision');
    }

    logger.debug('LLM routing decision', {
      message: message.slice(0, 50),
      agent: decision.agent,
      confidence: decision.confidence,
    });

    return decision;
  } catch (error) {
    logger.error('LLM routing failed', { error, message: message.slice(0, 50) });
    throw error;
  }
}

/**
 * Main routing function with LLM primary and heuristic fallback
 */
export async function routeMessage(
  message: string,
  options: { forceHeuristic?: boolean; timeout?: number } = {}
): Promise<RoutingDecision> {
  const { forceHeuristic = false, timeout = 2000 } = options;

  // Use heuristic only if forced or no API key
  if (forceHeuristic || !process.env.OPENAI_API_KEY) {
    logger.debug('Using heuristic routing', { forceHeuristic, hasApiKey: !!process.env.OPENAI_API_KEY });
    return heuristicRoute(message);
  }

  try {
    // Race LLM against timeout
    const llmPromise = llmRoute(message);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeout)
    );

    const result = await Promise.race([llmPromise, timeoutPromise]);

    if (result === null) {
      logger.warn('LLM routing timed out, using heuristic', { timeout });
      const heuristic = heuristicRoute(message);
      return {
        ...heuristic,
        rationale: `LLM timed out, heuristic: ${heuristic.rationale}`,
      };
    }

    return result;
  } catch (error) {
    logger.warn('LLM routing failed, using heuristic', { error });
    const heuristic = heuristicRoute(message);
    return {
      ...heuristic,
      rationale: `LLM failed, heuristic: ${heuristic.rationale}`,
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- apps/web/tests/agents/sdk/router.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/agents/sdk/router.ts apps/web/tests/agents/sdk/router.test.ts
git commit -m "feat(agents): implement gpt-5-nano router with structured outputs"
```

---

## Phase 3: Agents SDK Integration

### Task 3.1: Define All Agents

**Files:**
- Create: `apps/web/src/lib/agents/sdk/agents.ts`

**Step 1: Create agent definitions**

Create `apps/web/src/lib/agents/sdk/agents.ts`:
```typescript
/**
 * Agent Definitions for OpenAI Agents SDK
 * Each agent has specialized capabilities and tools
 */

import { defaultTools } from './tools/default';
import { spotifyTools } from './tools/spotify';
import { githubTools } from './tools/github';
// Import other tools as they're implemented
// import { googleTools } from './tools/google';
// import { homeTools } from './tools/home';
// import { financeTools } from './tools/finance';
// import { imageTools } from './tools/image';

/**
 * Agent configuration type
 */
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  instructions: string;
  tools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/**
 * Personality Agent (Q8) - General chat, Spotify, Weather
 * Model: Grok 4.1 Fast (best emotional IQ, 2M context)
 */
export const personalityAgent: AgentConfig = {
  name: 'Q8',
  description: 'Friendly AI assistant for general chat, music control, and weather',
  model: 'grok-4-1-fast',
  instructions: `You are Q8, a friendly and helpful AI personal assistant.

## Personality
- Warm, approachable, and occasionally witty
- Concise but not curt - find the right balance
- Enthusiastic about music and helping with daily tasks
- Never robotic or overly formal

## Capabilities
- Control Spotify playback (play, pause, skip, search, queue)
- Get weather information for any location
- General conversation and creative tasks
- Date/time queries with timezone support
- Basic calculations

## Guidelines
- Use Spotify tools proactively when music is mentioned
- Check weather when asked about outdoor activities
- Keep responses focused and helpful
- Add personality without being excessive`,
  tools: [...defaultTools, ...spotifyTools],
};

/**
 * Coder Agent (DevBot) - GitHub, Code, SQL
 * Model: Claude Opus 4.5 (most intelligent for coding)
 */
export const coderAgent: AgentConfig = {
  name: 'DevBot',
  description: 'Expert software engineer for code, GitHub, and database operations',
  model: 'claude-opus-4-5-20251101',
  instructions: `You are DevBot, an expert software engineer assistant.

## Expertise
- Code review and analysis
- Debugging and troubleshooting
- GitHub operations (PRs, issues, code search)
- SQL and database operations
- Architecture recommendations

## Guidelines
- Be precise and technical
- Always explain your reasoning
- Provide code examples when helpful
- Consider edge cases and error handling
- Suggest best practices and improvements

## Tools
Use GitHub tools to search code, view PRs, and create issues.
Always confirm before creating or modifying resources.`,
  tools: githubTools,
};

/**
 * Researcher Agent - Web search, Research
 * Model: Perplexity Sonar Reasoning Pro (real-time search)
 */
export const researcherAgent: AgentConfig = {
  name: 'ResearchBot',
  description: 'Research specialist with real-time web search',
  model: 'sonar-reasoning-pro',
  instructions: `You are ResearchBot, a research specialist with real-time web access.

## Capabilities
- Real-time web search
- Fact verification and source checking
- News and current events
- Academic research synthesis
- Documentation lookup

## Guidelines
- Always cite your sources
- Distinguish between facts and opinions
- Provide multiple perspectives when relevant
- Be thorough but concise
- Update information with "as of [date]" when time-sensitive`,
  tools: [], // Perplexity has built-in search
};

/**
 * Secretary Agent - Email, Calendar, Drive, YouTube
 * Model: Gemini 3 Flash (fast, 1M context)
 */
export const secretaryAgent: AgentConfig = {
  name: 'SecretaryBot',
  description: 'Productivity assistant for email, calendar, and Google services',
  model: 'gemini-3-flash-preview',
  instructions: `You are SecretaryBot, a productivity assistant for Google Workspace.

## Capabilities
- Email management (read, send, search Gmail)
- Calendar management (view, create, update events)
- Google Drive file search
- YouTube video search
- Meeting coordination

## Guidelines
- Be organized and proactive
- Warn about scheduling conflicts
- Summarize emails concisely
- Confirm before sending emails or creating events
- Respect privacy - don't share sensitive details unnecessarily`,
  tools: [], // TODO: Add Google tools when implemented
};

/**
 * Home Agent - Smart home control
 * Model: GPT-5-mini (high rate limits, good tool calling)
 */
export const homeAgent: AgentConfig = {
  name: 'HomeBot',
  description: 'Smart home controller for Home Assistant devices',
  model: 'gpt-5-mini',
  instructions: `You are HomeBot, a smart home controller.

## Capabilities
- Light control (on, off, brightness, color)
- Thermostat and HVAC control
- Lock and door management
- Scene activation
- Device status monitoring

## Guidelines
- Confirm before executing security-sensitive actions (locks, garage)
- Provide status feedback after actions
- Suggest scenes for common scenarios
- Be concise - smart home commands should be quick`,
  tools: [], // TODO: Add Home Assistant tools when implemented
};

/**
 * Finance Agent - Banking, Spending, Investments
 * Model: Gemini 3 Flash (accurate with numbers)
 */
export const financeAgent: AgentConfig = {
  name: 'FinanceBot',
  description: 'Personal finance advisor for banking and budgeting',
  model: 'gemini-3-flash-preview',
  instructions: `You are FinanceBot, a personal finance advisor.

## Capabilities
- Bank account balances and transactions
- Spending analysis and summaries
- Bill tracking and reminders
- Investment portfolio overview
- Budget planning and affordability checks

## Guidelines
- Be accurate with numbers - double-check calculations
- Present financial data clearly (tables when helpful)
- Be cautious with financial advice
- Respect privacy - never expose full account numbers
- Highlight unusual spending or potential issues`,
  tools: [], // TODO: Add Plaid/SnapTrade tools when implemented
};

/**
 * ImageGen Agent - Image generation and analysis
 * Model: GPT-5-mini (orchestrates image tools)
 */
export const imageGenAgent: AgentConfig = {
  name: 'ImageGen',
  description: 'Visual content creator for images, diagrams, and charts',
  model: 'gpt-5-mini',
  instructions: `You are ImageGen, a visual content creator.

## Capabilities
- Generate images from text descriptions
- Create diagrams (flowcharts, architecture, etc.)
- Create charts (bar, pie, line, etc.)
- Analyze and describe images
- Edit images with instructions

## Guidelines
- Ask clarifying questions about style/format before generating
- Provide descriptive captions for generated images
- Suggest improvements or alternatives
- Be creative but respect the user's vision`,
  tools: [], // TODO: Add image tools when implemented
};

/**
 * All agents indexed by type
 */
export const agents: Record<string, AgentConfig> = {
  personality: personalityAgent,
  coder: coderAgent,
  researcher: researcherAgent,
  secretary: secretaryAgent,
  home: homeAgent,
  finance: financeAgent,
  imagegen: imageGenAgent,
};

/**
 * Get agent configuration by type
 */
export function getAgent(agentType: string): AgentConfig | undefined {
  return agents[agentType];
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/agents/sdk/agents.ts
git commit -m "feat(agents): define all agent configurations for Agents SDK"
```

---

### Task 3.2: Create Triage Agent with Handoffs

**Files:**
- Create: `apps/web/src/lib/agents/sdk/triage.ts`

**Step 1: Create triage agent**

Create `apps/web/src/lib/agents/sdk/triage.ts`:
```typescript
/**
 * Triage Agent - Routes requests to specialized agents
 * Uses gpt-5-nano for fast, cheap routing decisions
 */

import type { AgentConfig } from './agents';
import {
  personalityAgent,
  coderAgent,
  researcherAgent,
  secretaryAgent,
  homeAgent,
  financeAgent,
  imageGenAgent,
} from './agents';

/**
 * Handoff configuration
 */
export interface HandoffConfig {
  agent: AgentConfig;
  description: string;
  keywords: string[];
}

/**
 * All available handoffs
 */
export const handoffs: HandoffConfig[] = [
  {
    agent: coderAgent,
    description: 'Transfer to DevBot for code, GitHub, PRs, bugs, SQL, or programming questions.',
    keywords: ['code', 'bug', 'debug', 'github', 'pr', 'sql', 'function', 'error', 'programming'],
  },
  {
    agent: researcherAgent,
    description: 'Transfer to ResearchBot for web searches, research, news, or fact-checking.',
    keywords: ['search', 'research', 'news', 'latest', 'find information', 'look up'],
  },
  {
    agent: secretaryAgent,
    description: 'Transfer to SecretaryBot for email, calendar, meetings, Drive, or YouTube.',
    keywords: ['email', 'calendar', 'meeting', 'schedule', 'gmail', 'youtube', 'drive'],
  },
  {
    agent: homeAgent,
    description: 'Transfer to HomeBot for smart home control: lights, thermostat, locks, scenes.',
    keywords: ['light', 'lights', 'thermostat', 'temperature', 'lock', 'door', 'scene', 'home'],
  },
  {
    agent: financeAgent,
    description: 'Transfer to FinanceBot for money, budget, spending, investments, or banking.',
    keywords: ['money', 'budget', 'spending', 'balance', 'bank', 'investment', 'bill', 'finance'],
  },
  {
    agent: imageGenAgent,
    description: 'Transfer to ImageGen for creating images, diagrams, charts, or analyzing visuals.',
    keywords: ['image', 'picture', 'diagram', 'chart', 'generate', 'draw', 'visualize'],
  },
  {
    agent: personalityAgent,
    description: 'Transfer to Q8 for general chat, music/Spotify, weather, or casual conversation.',
    keywords: ['music', 'spotify', 'song', 'weather', 'hello', 'hi', 'chat', 'joke'],
  },
];

/**
 * Triage agent configuration
 */
export const triageAgent: AgentConfig = {
  name: 'Q8-Orchestrator',
  description: 'Routes requests to the most appropriate specialist agent',
  model: 'gpt-5-nano', // Fast, cheap routing
  instructions: `You are Q8's routing system. Your job is to quickly determine which specialist should handle the user's request.

## Available Specialists:
${handoffs.map(h => `- **${h.agent.name}**: ${h.description}`).join('\n')}

## Routing Rules (in priority order):
1. Code/GitHub/programming → DevBot
2. Web search/research/news → ResearchBot
3. Email/calendar/meetings/YouTube → SecretaryBot
4. Smart home/lights/thermostat → HomeBot
5. Money/budget/investments → FinanceBot
6. Create images/diagrams/charts → ImageGen
7. Music/Spotify/general chat/weather → Q8 (personality)

## Important:
- Route to the specialist immediately after determining the right one
- Don't try to answer questions yourself
- When uncertain, route to Q8 (personality) as the safe default
- Be fast - routing should take minimal time`,
  tools: [], // Triage agent doesn't use tools, just routes
};

/**
 * Build the handoff tools for the triage agent
 * These are special "transfer" functions the LLM can call
 */
export function buildHandoffTools(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return handoffs.map(({ agent, description }) => ({
    type: 'function' as const,
    function: {
      name: `transfer_to_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      description,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for the transfer',
          },
        },
        required: ['reason'],
      },
    },
  }));
}

/**
 * Get the target agent from a handoff tool call
 */
export function getHandoffTarget(toolName: string): AgentConfig | undefined {
  // Extract agent name from tool name (e.g., "transfer_to_devbot" -> "devbot")
  const match = toolName.match(/^transfer_to_(.+)$/);
  if (!match) return undefined;

  const targetName = match[1]?.toLowerCase();
  return handoffs.find(
    h => h.agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_') === targetName
  )?.agent;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/agents/sdk/triage.ts
git commit -m "feat(agents): create triage agent with handoff configurations"
```

---

### Task 3.3: Implement Agent Runner

**Files:**
- Create: `apps/web/src/lib/agents/sdk/runner.ts`

**Step 1: Create the runner**

Create `apps/web/src/lib/agents/sdk/runner.ts`:
```typescript
/**
 * Agent Runner - Executes agents with tool calling and handoffs
 * Provides both sync and streaming interfaces
 */

import OpenAI from 'openai';
import { type AgentConfig, getAgent } from './agents';
import { triageAgent, buildHandoffTools, getHandoffTarget } from './triage';
import { routeMessage, type RoutingDecision } from './router';
import { executeDefaultTool } from './tools/default';
import { executeSpotifyTool } from './tools/spotify';
import { executeGithubTool } from './tools/github';
import { logger } from '@/lib/logger';
import { getModel } from '../../model_factory';

/**
 * Tool execution result
 */
interface ToolResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: {
    code: string;
    recoverable: boolean;
    suggestion: string;
  };
}

/**
 * Stream event types
 */
export type AgentStreamEvent =
  | { type: 'routing'; decision: RoutingDecision }
  | { type: 'agent_start'; agent: string }
  | { type: 'handoff'; from: string; to: string; reason: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; id: string }
  | { type: 'tool_end'; tool: string; success: boolean; result?: unknown; id: string; duration?: number }
  | { type: 'content'; delta: string }
  | { type: 'done'; fullContent: string; agent: string; toolsUsed: string[] }
  | { type: 'error'; message: string; recoverable?: boolean };

/**
 * Run options
 */
export interface RunOptions {
  message: string;
  userId: string;
  threadId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  forceAgent?: string;
}

/**
 * Execute a tool by name
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  _userId: string
): Promise<ToolResult> {
  // Route to appropriate executor based on tool prefix
  if (toolName.startsWith('spotify_')) {
    return executeSpotifyTool(toolName, args);
  }
  if (toolName.startsWith('github_')) {
    return executeGithubTool(toolName, args);
  }
  // Default tools (datetime, weather, calculate)
  if (['get_current_datetime', 'calculate', 'get_weather'].includes(toolName)) {
    return executeDefaultTool(toolName, args);
  }

  // Unknown tool
  return {
    success: false,
    message: `Unknown tool: ${toolName}`,
    error: {
      code: 'UNKNOWN_TOOL',
      recoverable: false,
      suggestion: 'This tool is not available.',
    },
  };
}

/**
 * Create OpenAI client for an agent
 */
function createClient(agent: AgentConfig): OpenAI {
  const modelConfig = getModel(agent.name.toLowerCase() as 'coder' | 'researcher' | 'secretary' | 'home' | 'finance' | 'imagegen' | 'personality' | 'orchestrator');

  return new OpenAI({
    apiKey: modelConfig.apiKey || process.env.OPENAI_API_KEY,
    baseURL: modelConfig.baseURL,
    maxRetries: 3,
    timeout: 60000,
  });
}

/**
 * Stream agent execution
 */
export async function* streamAgent(options: RunOptions): AsyncGenerator<AgentStreamEvent> {
  const { message, userId, conversationHistory = [], forceAgent } = options;

  try {
    // Step 1: Route the message
    let targetAgent: AgentConfig;
    let routingDecision: RoutingDecision;

    if (forceAgent) {
      targetAgent = getAgent(forceAgent) || getAgent('personality')!;
      routingDecision = {
        agent: forceAgent as RoutingDecision['agent'],
        confidence: 1,
        rationale: 'User-specified agent',
      };
    } else {
      routingDecision = await routeMessage(message);
      targetAgent = getAgent(routingDecision.agent) || getAgent('personality')!;
    }

    yield { type: 'routing', decision: routingDecision };
    yield { type: 'agent_start', agent: targetAgent.name };

    // Step 2: Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: targetAgent.instructions },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Step 3: Create client and make completion request
    const client = createClient(targetAgent);
    const tools = targetAgent.tools.length > 0 ? targetAgent.tools : undefined;

    const completion = await client.chat.completions.create({
      model: targetAgent.model,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      max_tokens: 1000,
      stream: false, // Initial request to check for tool calls
    });

    const assistantMessage = completion.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;
    const toolsUsed: string[] = [];
    let fullContent = '';

    // Step 4: Handle tool calls if present
    if (toolCalls && toolCalls.length > 0) {
      const toolMessages: Array<{ role: 'tool'; tool_call_id: string; content: string }> = [];

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const toolId = toolCall.id;

        // Check for handoff
        const handoffTarget = getHandoffTarget(toolName);
        if (handoffTarget) {
          yield {
            type: 'handoff',
            from: targetAgent.name,
            to: handoffTarget.name,
            reason: toolArgs.reason || 'Specialist needed',
          };

          // Recursively call with the new agent
          for await (const event of streamAgent({
            ...options,
            forceAgent: handoffTarget.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          })) {
            yield event;
          }
          return;
        }

        // Regular tool execution
        yield { type: 'tool_start', tool: toolName, args: toolArgs, id: toolId };
        toolsUsed.push(toolName);

        const startTime = Date.now();
        const result = await executeTool(toolName, toolArgs, userId);
        const duration = Date.now() - startTime;

        yield {
          type: 'tool_end',
          tool: toolName,
          success: result.success,
          result: result.data || result.message,
          id: toolId,
          duration,
        };

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolId,
          content: JSON.stringify(result),
        });
      }

      // Get follow-up response after tool execution
      const followUp = await client.chat.completions.create({
        model: targetAgent.model,
        messages: [
          ...messages,
          { role: 'assistant', content: null, tool_calls: toolCalls } as OpenAI.ChatCompletionMessageParam,
          ...toolMessages,
        ],
        max_tokens: 1000,
      });

      fullContent = followUp.choices[0]?.message?.content || 'I executed the requested actions.';
    } else {
      // No tool calls, just content
      fullContent = assistantMessage?.content || '';
    }

    // Step 5: Stream content (simulate streaming for now)
    if (fullContent) {
      // In a real implementation, use actual streaming
      yield { type: 'content', delta: fullContent };
    }

    // Step 6: Done
    yield {
      type: 'done',
      fullContent,
      agent: targetAgent.name,
      toolsUsed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Agent execution failed', { error, message: options.message.slice(0, 50) });
    yield { type: 'error', message: errorMessage, recoverable: false };
  }
}

/**
 * Run agent and return final result (non-streaming)
 */
export async function runAgent(options: RunOptions): Promise<{
  content: string;
  agent: string;
  toolsUsed: string[];
  routingDecision: RoutingDecision;
}> {
  let content = '';
  let agent = '';
  let toolsUsed: string[] = [];
  let routingDecision: RoutingDecision = {
    agent: 'personality',
    confidence: 0,
    rationale: '',
  };

  for await (const event of streamAgent(options)) {
    switch (event.type) {
      case 'routing':
        routingDecision = event.decision;
        break;
      case 'done':
        content = event.fullContent;
        agent = event.agent;
        toolsUsed = event.toolsUsed;
        break;
      case 'error':
        throw new Error(event.message);
    }
  }

  return { content, agent, toolsUsed, routingDecision };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/agents/sdk/runner.ts
git commit -m "feat(agents): implement agent runner with streaming and tool execution"
```

---

### Task 3.4: Update Chat API Route

**Files:**
- Modify: `apps/web/src/app/api/chat/stream/route.ts`

**Step 1: Update the route to use new SDK runner**

The existing route at `apps/web/src/app/api/chat/stream/route.ts` should be updated to import and use the new SDK runner. For now, we'll add a feature flag to gradually migrate.

Add to the top of the file after existing imports:
```typescript
// New SDK runner (behind feature flag)
import { streamAgent as streamAgentSDK, type AgentStreamEvent } from '@/lib/agents/sdk/runner';

// Feature flag for gradual migration
const USE_NEW_SDK = process.env.USE_AGENTS_SDK === 'true';
```

Then update the POST handler to conditionally use the new SDK.

**Step 2: Commit**

```bash
git add apps/web/src/app/api/chat/stream/route.ts
git commit -m "feat(agents): add feature flag for Agents SDK migration"
```

---

## Phase 4: Testing & Validation

### Task 4.1: Integration Test for Full Flow

**Files:**
- Create: `apps/web/tests/agents/sdk/integration.test.ts`

**Step 1: Write integration test**

Create `apps/web/tests/agents/sdk/integration.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeMessage } from '@/lib/agents/sdk/router';
import { getAgent } from '@/lib/agents/sdk/agents';

describe('Agent Integration', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.SPOTIFY_REFRESH_TOKEN = 'test-token';
    process.env.SPOTIFY_CLIENT_ID = 'test-client';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
  });

  describe('Routing to Agent Flow', () => {
    it('routes music query to personality agent with spotify tools', async () => {
      const decision = await routeMessage('play some jazz music', { forceHeuristic: true });
      expect(decision.agent).toBe('personality');

      const agent = getAgent(decision.agent);
      expect(agent).toBeDefined();
      expect(agent?.tools.some(t => t.function.name === 'spotify_search')).toBe(true);
    });

    it('routes code query to coder agent with github tools', async () => {
      const decision = await routeMessage('list open PRs in the repo', { forceHeuristic: true });
      expect(decision.agent).toBe('coder');

      const agent = getAgent(decision.agent);
      expect(agent).toBeDefined();
      expect(agent?.tools.some(t => t.function.name === 'github_list_prs')).toBe(true);
    });

    it('routes weather query to personality agent with weather tools', async () => {
      const decision = await routeMessage('what is the weather in New York', { forceHeuristic: true });
      expect(decision.agent).toBe('personality');

      const agent = getAgent(decision.agent);
      expect(agent?.tools.some(t => t.function.name === 'get_weather')).toBe(true);
    });
  });
});
```

**Step 2: Run test**

```bash
pnpm test -- apps/web/tests/agents/sdk/integration.test.ts
```

**Step 3: Commit**

```bash
git add apps/web/tests/agents/sdk/integration.test.ts
git commit -m "test(agents): add integration tests for routing and agent flow"
```

---

## Summary Checklist

After completing all tasks, verify:

- [ ] `pnpm turbo typecheck` passes
- [ ] `pnpm turbo build --filter=@q8/web` succeeds
- [ ] `pnpm test -- apps/web/tests/agents/sdk/` passes

### Manual Testing (with `USE_AGENTS_SDK=true`):

- [ ] "Play some jazz music" → Routes to personality → Spotify tool called
- [ ] "What's the weather in NYC?" → Routes to personality → Weather tool called
- [ ] "List open PRs in q8 repo" → Routes to coder → GitHub tool called
- [ ] "Hello, how are you?" → Routes to personality → Conversational response
- [ ] "Turn off the lights" → Routes to home (tools pending implementation)

### Files Created:

```
apps/web/src/lib/agents/sdk/
├── index.ts
├── agents.ts
├── triage.ts
├── router.ts
├── runner.ts
├── tools/
│   ├── index.ts
│   ├── default.ts
│   ├── spotify.ts
│   └── github.ts
└── utils/
    ├── index.ts
    ├── retry.ts
    ├── errors.ts
    └── preflight.ts
```

### Remaining Work (Future Tasks):

1. Implement Google tools (Calendar, Gmail, Drive, YouTube)
2. Implement Home Assistant tools
3. Implement Finance tools (Plaid, SnapTrade)
4. Implement Image tools
5. Full migration of chat route (remove feature flag)
6. Archive legacy MCP code
