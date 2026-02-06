/**
 * Tests for Default Tools
 * These tools are available to ALL agents as default capabilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  getCurrentDatetime,
  getCurrentDatetimeTool,
  calculate,
  calculateTool,
  getWeather,
  getWeatherTool,
  defaultTools,
  type CalculateResult,
  type CalculateSuccessResult,
  type CalculateErrorResult,
  type GetWeatherResult,
  type GetWeatherSuccessResult,
  type GetWeatherErrorResult,
} from '@/lib/agents/sdk/tools/default';

// Type guard for calculate success result
function isCalculateSuccess(
  result: CalculateResult
): result is CalculateSuccessResult {
  return result.success === true;
}

// Type guard for calculate error result
function isCalculateError(
  result: CalculateResult
): result is CalculateErrorResult {
  return result.success === false;
}

// Type guard for weather success result
function isWeatherSuccess(
  result: GetWeatherResult
): result is GetWeatherSuccessResult {
  return result.success === true;
}

// Type guard for weather error result
function isWeatherError(
  result: GetWeatherResult
): result is GetWeatherErrorResult {
  return result.success === false;
}

describe('getCurrentDatetime', () => {
  beforeEach(() => {
    // Mock Date to have predictable tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current datetime in ISO format by default', async () => {
    const result = await getCurrentDatetime({});
    expect(result).toHaveProperty('datetime');
    expect(result).toHaveProperty('timezone');
    expect(result).toHaveProperty('formatted');
    expect(result.datetime).toBe('2026-02-05T14:30:00.000Z');
  });

  it('returns datetime in specified timezone', async () => {
    const result = await getCurrentDatetime({ timezone: 'America/New_York' });
    expect(result.timezone).toBe('America/New_York');
    expect(result.formatted).toContain('2026');
  });

  it('includes day of week in formatted output', async () => {
    const result = await getCurrentDatetime({ timezone: 'UTC' });
    expect(result.formatted).toContain('Thursday'); // 2026-02-05 is a Thursday
  });

  it('handles invalid timezone gracefully', async () => {
    const result = await getCurrentDatetime({ timezone: 'Invalid/Timezone' });
    // Should fall back to UTC
    expect(result.timezone).toBe('UTC');
  });

  it('tool definition has correct schema', () => {
    expect(getCurrentDatetimeTool.name).toBe('getCurrentDatetime');
    expect(getCurrentDatetimeTool.description).toContain('date');
    expect(getCurrentDatetimeTool.parameters).toBeDefined();
  });
});

describe('calculate', () => {
  it('evaluates simple arithmetic expressions', async () => {
    const result = await calculate({ expression: '2 + 2' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(4);
      expect(result.expression).toBe('2 + 2');
    }
  });

  it('evaluates complex expressions with multiple operators', async () => {
    const result = await calculate({ expression: '(10 + 5) * 2 - 3' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(27);
    }
  });

  it('evaluates expressions with functions', async () => {
    const result = await calculate({ expression: 'sqrt(144)' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(12);
    }
  });

  it('evaluates percentage expressions', async () => {
    const result = await calculate({ expression: '15% of 200' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(30);
    }
  });

  it('evaluates trigonometric functions', async () => {
    const result = await calculate({ expression: 'sin(0)' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(0);
    }
  });

  it('evaluates exponential expressions', async () => {
    const result = await calculate({ expression: '2^10' });
    expect(result.success).toBe(true);
    if (isCalculateSuccess(result)) {
      expect(result.result).toBe(1024);
    }
  });

  it('returns error for invalid expressions', async () => {
    const result = await calculate({ expression: 'invalid + + +' });
    expect(result.success).toBe(false);
    if (isCalculateError(result)) {
      expect(result.error).toBeDefined();
    }
  });

  it('returns error for empty expression', async () => {
    const result = await calculate({ expression: '' });
    expect(result.success).toBe(false);
    if (isCalculateError(result)) {
      expect(result.error).toBeDefined();
    }
  });

  it('handles division by zero', async () => {
    const result = await calculate({ expression: '1 / 0' });
    // mathjs returns Infinity which is not finite
    expect(result.success).toBe(false);
  });

  it('prevents code injection attempts', async () => {
    const result = await calculate({ expression: 'import("fs")' });
    expect(result.success).toBe(false);
  });

  it('tool definition has correct schema', () => {
    expect(calculateTool.name).toBe('calculate');
    expect(calculateTool.description).toContain('math');
    expect(calculateTool.parameters).toBeDefined();
  });
});

describe('getWeather', () => {
  const mockWeatherResponse = {
    main: {
      temp: 72,
      feels_like: 70,
      temp_min: 65,
      temp_max: 78,
      humidity: 45,
      pressure: 1013,
    },
    wind: {
      speed: 10,
      deg: 180,
    },
    weather: [
      {
        main: 'Clear',
        description: 'clear sky',
        icon: '01d',
      },
    ],
    visibility: 10000,
    clouds: { all: 0 },
    sys: {
      sunrise: 1738750800,
      sunset: 1738789200,
    },
    timezone: -18000,
    name: 'New York',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure OPENWEATHER_API_KEY is set for tests
    vi.stubEnv('OPENWEATHER_API_KEY', 'test-weather-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches weather by city name', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherResponse,
    } as Response);

    const result = await getWeather({ location: 'New York' });
    expect(result.success).toBe(true);
    if (isWeatherSuccess(result)) {
      expect(result.weather).toBeDefined();
      expect(result.weather.temp).toBe(72);
      expect(result.weather.condition).toBe('Clear');
      expect(result.weather.cityName).toBe('New York');
    }
  });

  it('fetches weather by coordinates', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherResponse,
    } as Response);

    const result = await getWeather({ lat: 40.7128, lon: -74.006 });
    expect(result.success).toBe(true);
    if (isWeatherSuccess(result)) {
      expect(result.weather).toBeDefined();
    }

    // Verify the fetch was called with correct coordinates
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('lat=40.7128')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('lon=-74.006')
    );
  });

  it('returns error when API key is missing', async () => {
    vi.stubEnv('OPENWEATHER_API_KEY', '');

    const result = await getWeather({ location: 'New York' });
    expect(result.success).toBe(false);
    if (isWeatherError(result)) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('MISSING_API_KEY');
    }
  });

  it('returns error when neither location nor coordinates provided', async () => {
    const result = await getWeather({});
    expect(result.success).toBe(false);
    if (isWeatherError(result)) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('handles API error responses', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const result = await getWeather({ location: 'NonexistentCity123' });
    expect(result.success).toBe(false);
    if (isWeatherError(result)) {
      expect(result.error).toBeDefined();
    }
  });

  it('handles network errors', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await getWeather({ location: 'New York' });
    expect(result.success).toBe(false);
    if (isWeatherError(result)) {
      expect(result.error).toBeDefined();
    }
  });

  it('tool definition has correct schema', () => {
    expect(getWeatherTool.name).toBe('getWeather');
    expect(getWeatherTool.description).toContain('weather');
    expect(getWeatherTool.parameters).toBeDefined();
  });
});

describe('defaultTools', () => {
  it('exports an array of all default tools', () => {
    expect(Array.isArray(defaultTools)).toBe(true);
    expect(defaultTools.length).toBe(3);
  });

  it('all tools have required properties', () => {
    for (const t of defaultTools) {
      const ft = t as FunctionTool;
      expect(ft).toHaveProperty('name');
      expect(ft).toHaveProperty('description');
      expect(ft).toHaveProperty('parameters');
      expect(ft).toHaveProperty('invoke');
      expect(typeof ft.name).toBe('string');
      expect(typeof ft.description).toBe('string');
      expect(typeof ft.invoke).toBe('function');
    }
  });

  it('tool names are unique', () => {
    const names = defaultTools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('includes getCurrentDatetime tool', () => {
    const tool = defaultTools.find((t) => t.name === 'getCurrentDatetime');
    expect(tool).toBeDefined();
  });

  it('includes calculate tool', () => {
    const tool = defaultTools.find((t) => t.name === 'calculate');
    expect(tool).toBeDefined();
  });

  it('includes getWeather tool', () => {
    const tool = defaultTools.find((t) => t.name === 'getWeather');
    expect(tool).toBeDefined();
  });
});
