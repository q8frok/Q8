/**
 * Weather Utility
 * Standalone weather lookup using OpenWeatherMap API.
 * Extracted from default.ts to avoid transitive mathjs dependency
 * in edge-runtime consumers (e.g. morning-brief cron).
 */

import { z } from 'zod';

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// =============================================================================
// Types
// =============================================================================

export const getWeatherParamsSchema = z.object({
  location: z
    .string()
    .nullable()
    .describe('City name (e.g., "New York", "London, UK")'),
  lat: z.number().nullable().describe('Latitude coordinate'),
  lon: z.number().nullable().describe('Longitude coordinate'),
});

export type GetWeatherParams = z.infer<typeof getWeatherParamsSchema>;

export interface WeatherData {
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust?: number;
  windDeg: number;
  condition: string;
  description: string;
  icon: string;
  visibility: number;
  clouds: number;
  sunrise: string;
  sunset: string;
  cityName: string;
  timezone?: number;
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

// =============================================================================
// Core function
// =============================================================================

/**
 * Get current weather for a location.
 * Provide either `location` (city name) or `lat`+`lon` coordinates.
 */
export async function getWeather(
  params: Partial<GetWeatherParams>
): Promise<GetWeatherResult> {
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
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `Weather API error: ${response.status} ${response.statusText}`,
          recoverable: response.status >= 500,
        },
      };
    }

    const data = await response.json();

    // Format Unix timestamps to readable time strings
    const formatUnixTime = (unix: number, tzOffset: number): string => {
      const date = new Date((unix + tzOffset) * 1000);
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      const period = utcHours >= 12 ? 'PM' : 'AM';
      const hours12 = utcHours % 12 || 12;
      return `${hours12}:${utcMinutes.toString().padStart(2, '0')} ${period}`;
    };

    const tzOffset = data.timezone || 0;

    const weather: WeatherData = {
      temp: data.main.temp,
      feelsLike: data.main.feels_like,
      tempMin: data.main.temp_min,
      tempMax: data.main.temp_max,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windGust: data.wind.gust,
      windDeg: data.wind.deg || 0,
      condition: data.weather[0]?.main || 'Unknown',
      description: data.weather[0]?.description || 'Unknown',
      icon: data.weather[0]?.icon || '01d',
      visibility: data.visibility || 10000,
      clouds: data.clouds?.all || 0,
      sunrise: data.sys?.sunrise ? formatUnixTime(data.sys.sunrise, tzOffset) : '6:00 AM',
      sunset: data.sys?.sunset ? formatUnixTime(data.sys.sunset, tzOffset) : '6:00 PM',
      cityName: data.name,
      timezone: tzOffset,
    };

    return { success: true, weather };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown weather error',
        recoverable: true,
      },
    };
  }
}
