/**
 * Default Tools for All Agents
 * These tools are available to ALL agents as default capabilities:
 * - getCurrentDatetime: Returns current date/time in user's timezone
 * - calculate: Safe math expression evaluation using mathjs
 * - getWeather: Weather lookup using OpenWeatherMap API
 *
 * Uses @openai/agents tool() for native SDK integration.
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import { safeEvaluate } from '@/lib/utils/safe-math';
import { createToolError } from '../utils/errors';

// =============================================================================
// getCurrentDatetime Tool
// =============================================================================

const getCurrentDatetimeParamsSchema = z.object({
  timezone: z
    .string()
    .nullable()
    .describe(
      'IANA timezone name (e.g., "America/New_York", "Europe/London"). Defaults to UTC.'
    ),
});

/** Makes nullable properties optional for TypeScript callers */
type NullableOptional<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];
};

type GetCurrentDatetimeParams = NullableOptional<z.infer<typeof getCurrentDatetimeParamsSchema>>;

interface GetCurrentDatetimeResult {
  datetime: string;
  timezone: string;
  formatted: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: string;
}

/**
 * Get the current date and time
 * Returns ISO datetime string along with formatted display and components
 */
export async function getCurrentDatetime(
  params: GetCurrentDatetimeParams
): Promise<GetCurrentDatetimeResult> {
  const now = new Date();
  let timezone = params.timezone || 'UTC';

  // Validate timezone by attempting to use it
  let isValidTimezone = true;
  try {
    now.toLocaleString('en-US', { timeZone: timezone });
  } catch {
    isValidTimezone = false;
    timezone = 'UTC';
  }

  // Get formatted date parts in the specified timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: isValidTimezone ? (params.timezone ?? undefined) : 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const formatted = now.toLocaleString('en-US', options);

  // Get day of week
  const dayOfWeek = now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
  });

  // Get individual components
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const getPartValue = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  return {
    datetime: now.toISOString(),
    timezone,
    formatted,
    year: getPartValue('year'),
    month: getPartValue('month'),
    day: getPartValue('day'),
    hour: getPartValue('hour'),
    minute: getPartValue('minute'),
    second: getPartValue('second'),
    dayOfWeek,
  };
}

export const getCurrentDatetimeTool = tool({
  name: 'getCurrentDatetime',
  description:
    'Get the current date and time. Optionally specify a timezone to get the time in that timezone. Returns ISO datetime, formatted string, and individual date components.',
  parameters: getCurrentDatetimeParamsSchema,
  execute: async (args) => {
    const result = await getCurrentDatetime(args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// calculate Tool
// =============================================================================

const calculateParamsSchema = z.object({
  expression: z
    .string()
    .describe(
      'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(144)", "15% of 200")'
    ),
});

type CalculateParams = z.infer<typeof calculateParamsSchema>;

export interface CalculateSuccessResult {
  success: true;
  expression: string;
  result: number;
}

export interface CalculateErrorResult {
  success: false;
  expression: string;
  error: string;
}

export type CalculateResult = CalculateSuccessResult | CalculateErrorResult;

/**
 * Safely evaluate a mathematical expression
 * Uses mathjs with security restrictions to prevent code injection
 */
export async function calculate(params: CalculateParams): Promise<CalculateResult> {
  const { expression } = params;

  if (!expression || expression.trim() === '') {
    return {
      success: false,
      expression: expression || '',
      error: 'Expression cannot be empty',
    };
  }

  try {
    const result = safeEvaluate(expression);
    return {
      success: true,
      expression,
      result,
    };
  } catch (error) {
    return {
      success: false,
      expression,
      error: error instanceof Error ? error.message : 'Failed to evaluate expression',
    };
  }
}

export const calculateTool = tool({
  name: 'calculate',
  description:
    'Evaluate a mathematical expression safely. Supports arithmetic operations (+, -, *, /, ^), functions (sqrt, sin, cos, tan, log, etc.), percentages (15% of 200), and more. Returns the numeric result or an error message.',
  parameters: calculateParamsSchema,
  execute: async (args) => {
    const result = await calculate(args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// getWeather Tool
// =============================================================================

const getWeatherParamsSchema = z.object({
  location: z
    .string()
    .nullable()
    .describe('City name (e.g., "New York", "London, UK")'),
  lat: z.number().nullable().describe('Latitude coordinate'),
  lon: z.number().nullable().describe('Longitude coordinate'),
});

type GetWeatherParams = z.infer<typeof getWeatherParamsSchema>;

export interface WeatherData {
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
  description: string;
  icon: string;
  visibility: number;
  clouds: number;
  cityName: string;
}

export interface GetWeatherSuccessResult {
  success: true;
  weather: WeatherData;
}

export interface GetWeatherErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export type GetWeatherResult = GetWeatherSuccessResult | GetWeatherErrorResult;

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Get current weather for a location
 * Uses OpenWeatherMap API
 */
export async function getWeather(
  params: Partial<GetWeatherParams>
): Promise<GetWeatherResult> {
  // Get API key from environment
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'OpenWeather API key is not configured',
        recoverable: false,
      },
    };
  }

  // Validate params — either location or lat+lon required
  if (!params.location && (params.lat == null || params.lon == null)) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Either location or both lat and lon must be provided',
        recoverable: false,
      },
    };
  }

  try {
    let url: string;

    if (params.location) {
      url = `${OPENWEATHER_BASE_URL}/weather?q=${encodeURIComponent(params.location)}&units=imperial&appid=${apiKey}`;
    } else {
      url = `${OPENWEATHER_BASE_URL}/weather?lat=${params.lat}&lon=${params.lon}&units=imperial&appid=${apiKey}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorResult = createToolError(
        'weather_get',
        new Error(`Weather API error: ${response.status} ${response.statusText}`)
      );
      return {
        success: false,
        error: {
          code: errorResult.error.code,
          message: errorResult.message,
          recoverable: errorResult.error.recoverable,
        },
      };
    }

    const data = await response.json();

    const weather: WeatherData = {
      temp: data.main.temp,
      feelsLike: data.main.feels_like,
      tempMin: data.main.temp_min,
      tempMax: data.main.temp_max,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windDeg: data.wind.deg || 0,
      condition: data.weather[0]?.main || 'Unknown',
      description: data.weather[0]?.description || 'Unknown',
      icon: data.weather[0]?.icon || '01d',
      visibility: data.visibility || 10000,
      clouds: data.clouds?.all || 0,
      cityName: data.name,
    };

    return {
      success: true,
      weather,
    };
  } catch (error) {
    const errorResult = createToolError('weather_get', error);
    return {
      success: false,
      error: {
        code: errorResult.error.code,
        message: errorResult.message,
        recoverable: errorResult.error.recoverable,
      },
    };
  }
}

export const getWeatherTool = tool({
  name: 'getWeather',
  description:
    'Get current weather conditions for a location. Provide either a city name or latitude/longitude coordinates. Returns temperature, humidity, wind, and conditions.',
  parameters: getWeatherParamsSchema,
  execute: async (args) => {
    const result = await getWeather(args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// Export all default tools
// =============================================================================

export const defaultTools: Tool[] = [
  getCurrentDatetimeTool,
  calculateTool,
  getWeatherTool,
];
