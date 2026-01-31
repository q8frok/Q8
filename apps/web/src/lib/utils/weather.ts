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
        ? 'from-blue-400 via-cyan-300 to-blue-200'
        : 'from-indigo-900 via-purple-900 to-blue-900',
      particles: 'none',
      intensity: 'light',
    },
    clouds: {
      gradient: isDay
        ? 'from-gray-400 via-gray-300 to-gray-200'
        : 'from-gray-800 via-gray-700 to-gray-600',
      particles: 'none',
      intensity: 'medium',
    },
    rain: {
      gradient: isDay
        ? 'from-slate-500 via-slate-400 to-slate-300'
        : 'from-slate-800 via-slate-700 to-slate-600',
      particles: 'rain',
      intensity: 'heavy',
    },
    drizzle: {
      gradient: isDay
        ? 'from-slate-400 via-slate-300 to-slate-200'
        : 'from-slate-700 via-slate-600 to-slate-500',
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
        ? 'from-slate-300 via-slate-200 to-white'
        : 'from-slate-600 via-slate-500 to-slate-400',
      particles: 'snow',
      intensity: 'medium',
    },
    mist: {
      gradient: isDay
        ? 'from-gray-300 via-gray-200 to-gray-100'
        : 'from-gray-700 via-gray-600 to-gray-500',
      particles: 'none',
      intensity: 'medium',
    },
    fog: {
      gradient: 'from-gray-400 via-gray-300 to-gray-200',
      particles: 'none',
      intensity: 'heavy',
    },
    haze: {
      gradient: isDay
        ? 'from-amber-200 via-orange-100 to-yellow-100'
        : 'from-orange-900 via-amber-800 to-yellow-900',
      particles: 'none',
      intensity: 'light',
    },
    dust: {
      gradient: 'from-amber-400 via-orange-300 to-yellow-200',
      particles: 'none',
      intensity: 'medium',
    },
    sand: {
      gradient: 'from-orange-400 via-amber-300 to-yellow-200',
      particles: 'none',
      intensity: 'medium',
    },
    smoke: {
      gradient: 'from-gray-600 via-gray-500 to-gray-400',
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
