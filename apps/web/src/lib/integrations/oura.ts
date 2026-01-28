/**
 * Oura Ring API Client
 * Fetches sleep and readiness data for bio-rhythm calculations
 */

import { logger } from '@/lib/logger';

export interface OuraSleepData {
  date: string;
  sleepScore: number;
  totalSleepDuration: number;  // minutes
  efficiency: number;          // percentage
  restfulness: number;         // percentage
  remSleepDuration: number;    // minutes
  deepSleepDuration: number;   // minutes
  lightSleepDuration: number;  // minutes
  awakeTime: number;           // minutes
  bedtimeStart: string;        // ISO datetime
  bedtimeEnd: string;          // ISO datetime
}

export interface OuraReadinessData {
  date: string;
  readinessScore: number;
  temperatureDeviation: number;
  hrvBalance: number;
  bodyTemperature: number;
  previousDayActivity: number;
  sleepBalance: number;
  previousNight: number;
  recoveryIndex: number;
  restingHeartRate: number;
}

export interface OuraDailySummary {
  sleep: OuraSleepData | null;
  readiness: OuraReadinessData | null;
  fetchedAt: string;
}

// Cache for Oura data (1 hour TTL)
const ouraCache = new Map<string, { data: OuraDailySummary; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Oura API Client
 */
class OuraClient {
  private baseUrl = 'https://api.ouraring.com/v2';
  private accessToken: string | null = null;

  constructor() {
    this.accessToken = process.env.OURA_PERSONAL_ACCESS_TOKEN || null;
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    if (!this.accessToken) {
      logger.warn('[Oura] No access token configured');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logger.error('[Oura] Invalid or expired access token');
          return null;
        }
        throw new Error(`Oura API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.error('[Oura] API request failed', { endpoint, error });
      return null;
    }
  }

  /**
   * Get sleep data for a date range
   */
  async getSleepData(startDate: string, endDate: string): Promise<OuraSleepData[]> {
    const data = await this.fetch<{ data: OuraSleepItem[] }>(
      `/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`
    );

    if (!data?.data) return [];

    return data.data.map(transformSleepData);
  }

  /**
   * Get readiness data for a date range
   */
  async getReadinessData(startDate: string, endDate: string): Promise<OuraReadinessData[]> {
    const data = await this.fetch<{ data: OuraReadinessItem[] }>(
      `/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`
    );

    if (!data?.data) return [];

    return data.data.map(transformReadinessData);
  }

  /**
   * Get today's daily summary
   */
  async getDailySummary(): Promise<OuraDailySummary> {
    const today = new Date().toISOString().split('T')[0] as string;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] as string;

    // Check cache first
    const cached = ouraCache.get('daily_summary');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Fetch fresh data
    const [sleepData, readinessData] = await Promise.all([
      this.getSleepData(yesterday, today),
      this.getReadinessData(yesterday, today),
    ]);

    const lastSleep = sleepData.length > 0 ? sleepData[sleepData.length - 1] : null;
    const lastReadiness = readinessData.length > 0 ? readinessData[readinessData.length - 1] : null;

    const summary: OuraDailySummary = {
      sleep: lastSleep ?? null,
      readiness: lastReadiness ?? null,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    ouraCache.set('daily_summary', { data: summary, timestamp: Date.now() });

    return summary;
  }

  /**
   * Check if Oura integration is available
   */
  isConfigured(): boolean {
    return !!this.accessToken;
  }
}

// Raw Oura API types
interface OuraSleepItem {
  day: string;
  score: number;
  total_sleep_duration: number;
  efficiency: number;
  restfulness: number;
  rem_sleep_duration: number;
  deep_sleep_duration: number;
  light_sleep_duration: number;
  awake_time: number;
  bedtime_start: string;
  bedtime_end: string;
}

interface OuraReadinessItem {
  day: string;
  score: number;
  temperature_deviation: number;
  hrv_balance: number;
  body_temperature: number;
  previous_day_activity: number;
  sleep_balance: number;
  previous_night: number;
  recovery_index: number;
  resting_heart_rate: number;
}

function transformSleepData(item: OuraSleepItem): OuraSleepData {
  return {
    date: item.day,
    sleepScore: item.score,
    totalSleepDuration: Math.round(item.total_sleep_duration / 60), // seconds to minutes
    efficiency: item.efficiency,
    restfulness: item.restfulness,
    remSleepDuration: Math.round(item.rem_sleep_duration / 60),
    deepSleepDuration: Math.round(item.deep_sleep_duration / 60),
    lightSleepDuration: Math.round(item.light_sleep_duration / 60),
    awakeTime: Math.round(item.awake_time / 60),
    bedtimeStart: item.bedtime_start,
    bedtimeEnd: item.bedtime_end,
  };
}

function transformReadinessData(item: OuraReadinessItem): OuraReadinessData {
  return {
    date: item.day,
    readinessScore: item.score,
    temperatureDeviation: item.temperature_deviation,
    hrvBalance: item.hrv_balance,
    bodyTemperature: item.body_temperature,
    previousDayActivity: item.previous_day_activity,
    sleepBalance: item.sleep_balance,
    previousNight: item.previous_night,
    recoveryIndex: item.recovery_index,
    restingHeartRate: item.resting_heart_rate,
  };
}

// Singleton instance
export const ouraClient = new OuraClient();

/**
 * Get bio-rhythm state from Oura data
 */
export async function getBioRhythmState(): Promise<BioRhythmState | null> {
  if (!ouraClient.isConfigured()) {
    logger.debug('[Oura] Not configured, returning null bio-rhythm');
    return null;
  }

  try {
    const summary = await ouraClient.getDailySummary();
    return calculateBioRhythm(summary);
  } catch (error) {
    logger.error('[Oura] Failed to get bio-rhythm state', { error });
    return null;
  }
}

export interface BioRhythmState {
  // Overall state
  energyLevel: 'very_low' | 'low' | 'normal' | 'high' | 'very_high';
  recoveryStatus: 'poor' | 'fair' | 'good' | 'excellent';

  // Scores
  sleepScore: number;
  readinessScore: number;
  combinedScore: number;

  // Lighting recommendations
  lightingPreset: LightingPreset;
  colorTemperature: number;  // Kelvin
  brightness: number;        // 0-100

  // Raw data
  sleep: OuraSleepData | null;
  readiness: OuraReadinessData | null;

  // Metadata
  calculatedAt: string;
}

export interface LightingPreset {
  name: string;
  colorTemperature: number;
  brightness: number;
  description: string;
}

/**
 * Calculate bio-rhythm state from Oura data
 */
function calculateBioRhythm(summary: OuraDailySummary): BioRhythmState {
  const { sleep, readiness } = summary;
  const now = new Date();
  const hour = now.getHours();

  // Default scores if no data
  const sleepScore = sleep?.sleepScore ?? 70;
  const readinessScore = readiness?.readinessScore ?? 70;
  const combinedScore = Math.round((sleepScore + readinessScore) / 2);

  // Determine energy level
  let energyLevel: BioRhythmState['energyLevel'] = 'normal';
  if (combinedScore >= 85) energyLevel = 'very_high';
  else if (combinedScore >= 75) energyLevel = 'high';
  else if (combinedScore >= 60) energyLevel = 'normal';
  else if (combinedScore >= 45) energyLevel = 'low';
  else energyLevel = 'very_low';

  // Determine recovery status
  let recoveryStatus: BioRhythmState['recoveryStatus'] = 'fair';
  if (readinessScore >= 85) recoveryStatus = 'excellent';
  else if (readinessScore >= 70) recoveryStatus = 'good';
  else if (readinessScore >= 50) recoveryStatus = 'fair';
  else recoveryStatus = 'poor';

  // Calculate lighting preset based on time of day and bio-rhythm
  const lightingPreset = calculateLightingPreset(hour, combinedScore, sleep);

  return {
    energyLevel,
    recoveryStatus,
    sleepScore,
    readinessScore,
    combinedScore,
    lightingPreset,
    colorTemperature: lightingPreset.colorTemperature,
    brightness: lightingPreset.brightness,
    sleep,
    readiness,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate optimal lighting preset
 */
function calculateLightingPreset(
  hour: number,
  combinedScore: number,
  sleep: OuraSleepData | null
): LightingPreset {
  // Morning (5-9): Cool light to wake up
  if (hour >= 5 && hour < 9) {
    // If well-rested, use brighter cool light
    if (combinedScore >= 75) {
      return {
        name: 'Energize Morning',
        colorTemperature: 5500,
        brightness: 80,
        description: 'Cool, bright light to start your well-rested day',
      };
    }
    // If tired, use gentler warm light
    return {
      name: 'Gentle Wake',
      colorTemperature: 3500,
      brightness: 50,
      description: 'Warm, moderate light for a gentle wake-up',
    };
  }

  // Daytime (9-17): Full brightness
  if (hour >= 9 && hour < 17) {
    // Adjust based on energy
    if (combinedScore >= 70) {
      return {
        name: 'Focus',
        colorTemperature: 4500,
        brightness: 75,
        description: 'Neutral light for productivity',
      };
    }
    return {
      name: 'Balanced',
      colorTemperature: 4000,
      brightness: 65,
      description: 'Comfortable light for steady work',
    };
  }

  // Evening (17-21): Warm down
  if (hour >= 17 && hour < 21) {
    return {
      name: 'Relax',
      colorTemperature: 2700,
      brightness: 50,
      description: 'Warm light to wind down',
    };
  }

  // Night (21+): Sleep preparation
  // Check if past typical bedtime
  const typicalBedtime = sleep?.bedtimeStart
    ? new Date(sleep.bedtimeStart).getHours()
    : 23;

  if (hour >= typicalBedtime || hour < 5) {
    return {
      name: 'Night Mode',
      colorTemperature: 1800,
      brightness: 15,
      description: 'Red spectrum light to preserve melatonin',
    };
  }

  return {
    name: 'Wind Down',
    colorTemperature: 2200,
    brightness: 30,
    description: 'Very warm, dim light for sleep preparation',
  };
}

/**
 * Clear the Oura cache
 */
export function clearOuraCache(): void {
  ouraCache.clear();
}
