/**
 * Weather Utilities
 * Dynamic backgrounds and weather condition helpers
 */

export type WeatherCondition = 
  | 'clear'
  | 'clouds'
  | 'rain'
  | 'drizzle'
  | 'thunderstorm'
  | 'snow'
  | 'mist'
  | 'fog'
  | 'haze'
  | 'dust'
  | 'sand'
  | 'smoke'
  | 'tornado';

export interface WeatherBackground {
  gradient: string;
  particles?: 'rain' | 'snow' | 'none';
  intensity: 'light' | 'medium' | 'heavy';
}

export function getWeatherBackground(condition: string, isDay: boolean = true): WeatherBackground {
  const normalizedCondition = condition.toLowerCase() as WeatherCondition;

  const backgrounds: Record<WeatherCondition, WeatherBackground> = {
    clear: {
      gradient: isDay
        ? 'from-blue-900 via-blue-800 to-cyan-900'
        : 'from-indigo-900 via-purple-900 to-blue-900',
      particles: 'none',
      intensity: 'light',
    },
    clouds: {
      gradient: isDay
        ? 'from-gray-800 via-slate-700 to-gray-800'
        : 'from-gray-900 via-gray-800 to-gray-900',
      particles: 'none',
      intensity: 'medium',
    },
    rain: {
      gradient: isDay
        ? 'from-slate-800 via-blue-900 to-slate-800'
        : 'from-slate-900 via-slate-800 to-blue-950',
      particles: 'rain',
      intensity: 'heavy',
    },
    drizzle: {
      gradient: isDay
        ? 'from-slate-700 via-blue-800 to-slate-700'
        : 'from-slate-800 via-slate-700 to-blue-900',
      particles: 'rain',
      intensity: 'light',
    },
    thunderstorm: {
      gradient: 'from-gray-900 via-purple-900 to-gray-800',
      particles: 'rain',
      intensity: 'heavy',
    },
    snow: {
      gradient: isDay
        ? 'from-slate-700 via-blue-800 to-slate-700'
        : 'from-slate-800 via-slate-700 to-blue-900',
      particles: 'snow',
      intensity: 'medium',
    },
    mist: {
      gradient: isDay
        ? 'from-gray-700 via-slate-700 to-gray-800'
        : 'from-gray-800 via-gray-700 to-slate-800',
      particles: 'none',
      intensity: 'medium',
    },
    fog: {
      gradient: 'from-gray-800 via-slate-700 to-gray-800',
      particles: 'none',
      intensity: 'heavy',
    },
    haze: {
      gradient: isDay
        ? 'from-amber-900 via-orange-900 to-yellow-950'
        : 'from-orange-950 via-amber-900 to-yellow-950',
      particles: 'none',
      intensity: 'light',
    },
    dust: {
      gradient: 'from-amber-900 via-orange-900 to-yellow-950',
      particles: 'none',
      intensity: 'medium',
    },
    sand: {
      gradient: 'from-orange-950 via-amber-900 to-yellow-950',
      particles: 'none',
      intensity: 'medium',
    },
    smoke: {
      gradient: 'from-gray-800 via-gray-700 to-gray-800',
      particles: 'none',
      intensity: 'heavy',
    },
    tornado: {
      gradient: 'from-gray-900 via-gray-800 to-gray-700',
      particles: 'none',
      intensity: 'heavy',
    },
  };

  return backgrounds[normalizedCondition] || backgrounds.clear;
}

export function getWeatherEmoji(condition: string): string {
  const normalizedCondition = condition.toLowerCase();

  const emojis: Record<string, string> = {
    clear: '☀️',
    clouds: '☁️',
    rain: '🌧️',
    drizzle: '🌦️',
    thunderstorm: '⛈️',
    snow: '❄️',
    mist: '🌫️',
    fog: '🌫️',
    haze: '🌫️',
    dust: '💨',
    sand: '💨',
    smoke: '💨',
    tornado: '🌪️',
  };

  return emojis[normalizedCondition] || '🌤️';
}

export function getWeatherDescription(condition: string): string {
  const normalizedCondition = condition.toLowerCase();

  const descriptions: Record<string, string> = {
    clear: 'Clear skies',
    clouds: 'Cloudy',
    rain: 'Rainy',
    drizzle: 'Light rain',
    thunderstorm: 'Thunderstorm',
    snow: 'Snowy',
    mist: 'Misty',
    fog: 'Foggy',
    haze: 'Hazy',
    dust: 'Dusty',
    sand: 'Sandy',
    smoke: 'Smoky',
    tornado: 'Tornado warning',
  };

  return descriptions[normalizedCondition] || 'Unknown';
}

export function isDay(sunriseTime: number, sunsetTime: number, currentTime: number = Date.now()): boolean {
  const current = currentTime / 1000;
  return current >= sunriseTime && current < sunsetTime;
}
