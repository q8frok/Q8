import { NextRequest, NextResponse } from 'next/server';
import { getWeather } from '@/lib/agents/sdk/tools/weather';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

// Default location: User's NYC location
const DEFAULT_LAT = 40.7472;
const DEFAULT_LON = -73.9903;

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Fetch forecast data from OpenWeatherMap
 */
async function fetchForecast(lat: number, lon: number, days: number = 7) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  const url = `${OPENWEATHER_BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=imperial&cnt=${days * 8}&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  // Group by day and pick midday entry
  const daily = new Map<string, unknown>();
  for (const item of data.list) {
    const date = item.dt_txt?.split(' ')[0];
    if (date && !daily.has(date)) {
      daily.set(date, {
        date: item.dt_txt,
        temp: item.main.temp,
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        condition: item.weather[0]?.main,
        description: item.weather[0]?.description,
        icon: item.weather[0]?.icon,
        precipitation: item.pop ?? 0,
      });
    }
  }
  return Array.from(daily.values()).slice(0, days);
}

/**
 * Fetch air quality data from OpenWeatherMap
 */
async function fetchAirQuality(lat: number, lon: number) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.list?.[0];
  if (!item) return null;
  const aqiLabels = ['good', 'fair', 'moderate', 'poor', 'very_poor'];
  return {
    aqi: item.main.aqi * 20, // 1-5 scale to ~0-100
    category: aqiLabels[(item.main.aqi ?? 1) - 1] || 'unknown',
    pm25: item.components?.pm2_5,
    pm10: item.components?.pm10,
    o3: item.components?.o3,
    no2: item.components?.no2,
    co: item.components?.co,
    so2: item.components?.so2,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const includeForecast = searchParams.get('forecast') === 'true';
    const includeHourly = searchParams.get('hourly') === 'true';
    const includeAlerts = searchParams.get('alerts') === 'true';
    const includeAqi = searchParams.get('aqi') === 'true';

    const latitude = lat ? parseFloat(lat) : DEFAULT_LAT;
    const longitude = lon ? parseFloat(lon) : DEFAULT_LON;

    // Basic weather fetch via SDK utility
    const weatherResult = city
      ? await getWeather({ location: city })
      : await getWeather({ lat: latitude, lon: longitude });

    const weather = weatherResult.success ? weatherResult.weather : null;

    let forecast = null;
    const hourly = null;
    let airQuality = null;

    if (includeForecast || includeHourly) {
      try {
        forecast = await fetchForecast(latitude, longitude, 7);
      } catch {
        logger.warn('Forecast fetch failed');
      }
    }

    if (includeAqi) {
      try {
        airQuality = await fetchAirQuality(latitude, longitude);
      } catch {
        logger.warn('Air quality fetch failed');
      }
    }

    return NextResponse.json({
      current: weather,
      forecast,
      hourly,
      alerts: includeAlerts ? [] : undefined,
      airQuality,
      uvIndex: undefined,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Weather API error', { error: error });
    
    // Return mock data if API fails (for development without API key)
    return NextResponse.json({
      current: {
        temp: 45,
        feelsLike: 41,
        tempMin: 38,
        tempMax: 52,
        humidity: 68,
        pressure: 1015,
        windSpeed: 12,
        windDeg: 270,
        condition: 'Clouds',
        description: 'overcast clouds',
        icon: '04d',
        visibility: 10000,
        clouds: 90,
        sunrise: '6:45 AM',
        sunset: '4:32 PM',
        timezone: -18000,
        cityName: 'New York',
      },
      forecast: [
        { date: new Date().toISOString(), temp: 45, tempMin: 38, tempMax: 52, condition: 'Clouds', description: 'overcast', icon: '04d', precipitation: 0.1 },
        { date: new Date(Date.now() + 86400000).toISOString(), temp: 48, tempMin: 40, tempMax: 55, condition: 'Clear', description: 'clear sky', icon: '01d', precipitation: 0 },
        { date: new Date(Date.now() + 172800000).toISOString(), temp: 42, tempMin: 35, tempMax: 48, condition: 'Rain', description: 'light rain', icon: '10d', precipitation: 0.6 },
        { date: new Date(Date.now() + 259200000).toISOString(), temp: 38, tempMin: 32, tempMax: 44, condition: 'Clouds', description: 'scattered clouds', icon: '03d', precipitation: 0.2 },
        { date: new Date(Date.now() + 345600000).toISOString(), temp: 50, tempMin: 42, tempMax: 58, condition: 'Clear', description: 'sunny', icon: '01d', precipitation: 0 },
      ],
      hourly: generateMockHourlyData(),
      alerts: [],
      airQuality: {
        aqi: 42,
        category: 'good',
        pm25: 8.5,
        pm10: 15.2,
        o3: 45,
        no2: 12,
        co: 0.3,
        so2: 2,
      },
      uvIndex: {
        value: 3,
        category: 'moderate',
      },
      updatedAt: new Date().toISOString(),
      isMockData: true,
    });
  }
}

function generateMockHourlyData() {
  const hourly = [];
  const baseTemp = 45;
  const conditions = ['Clouds', 'Clouds', 'Clear', 'Clear', 'Clouds', 'Rain'];
  
  for (let i = 0; i < 24; i++) {
    const hour = new Date(Date.now() + i * 3600000);
    const tempVariation = Math.sin((i / 24) * Math.PI * 2) * 8;
    hourly.push({
      time: hour.toISOString(),
      temp: Math.round(baseTemp + tempVariation),
      condition: conditions[i % conditions.length],
      icon: conditions[i % conditions.length] === 'Clear' ? '01d' : conditions[i % conditions.length] === 'Rain' ? '10d' : '04d',
      precipitation: conditions[i % conditions.length] === 'Rain' ? 0.6 : 0.1,
      windSpeed: 8 + Math.random() * 8,
      humidity: 60 + Math.random() * 20,
    });
  }
  return hourly;
}
