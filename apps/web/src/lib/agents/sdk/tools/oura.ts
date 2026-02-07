/**
 * Oura Ring Tools
 * Sleep, readiness, and bio-rhythm data from Oura Ring
 * Assigned to: Home Agent
 *
 * Uses @openai/agents tool() for native SDK integration.
 * Auth: OURA_PERSONAL_ACCESS_TOKEN env var
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import { ouraClient, getBioRhythmState } from '@/lib/integrations/oura';
import { createToolError } from '../utils/errors';

// =============================================================================
// oura_sleep_summary
// =============================================================================

const ouraSleepSummarySchema = z.object({});

export const ouraSleepSummaryTool = tool({
  name: 'oura_sleep_summary',
  description:
    'Get last night\'s sleep data from the user\'s Oura Ring. Returns sleep score, total duration, ' +
    'deep/REM/light sleep breakdown, efficiency, bedtime, and wake time.',
  parameters: ouraSleepSummarySchema,
  execute: async () => {
    if (!ouraClient.isConfigured()) {
      return JSON.stringify({
        success: false,
        message: 'Oura Ring is not configured. The OURA_PERSONAL_ACCESS_TOKEN environment variable is missing.',
      });
    }

    try {
      const summary = await ouraClient.getDailySummary();

      if (!summary.sleep) {
        return JSON.stringify({
          success: true,
          message: 'No sleep data available for last night. The Oura Ring may not have synced yet.',
          sleep: null,
        });
      }

      const s = summary.sleep;
      const hours = Math.floor(s.totalSleepDuration / 60);
      const mins = s.totalSleepDuration % 60;

      return JSON.stringify({
        success: true,
        sleep: {
          date: s.date,
          sleepScore: s.sleepScore,
          totalDuration: `${hours}h ${mins}m`,
          totalDurationMinutes: s.totalSleepDuration,
          efficiency: `${s.efficiency}%`,
          restfulness: `${s.restfulness}%`,
          deepSleep: `${Math.round(s.deepSleepDuration)}min`,
          remSleep: `${Math.round(s.remSleepDuration)}min`,
          lightSleep: `${Math.round(s.lightSleepDuration)}min`,
          awakeTime: `${Math.round(s.awakeTime)}min`,
          bedtimeStart: s.bedtimeStart,
          bedtimeEnd: s.bedtimeEnd,
        },
      });
    } catch (error) {
      return JSON.stringify(createToolError('oura_sleep_summary', error));
    }
  },
});

// =============================================================================
// oura_readiness
// =============================================================================

const ouraReadinessSchema = z.object({});

export const ouraReadinessTool = tool({
  name: 'oura_readiness',
  description:
    'Get today\'s readiness score from the user\'s Oura Ring. Returns readiness score, ' +
    'resting heart rate, HRV balance, body temperature deviation, and recovery index.',
  parameters: ouraReadinessSchema,
  execute: async () => {
    if (!ouraClient.isConfigured()) {
      return JSON.stringify({
        success: false,
        message: 'Oura Ring is not configured. The OURA_PERSONAL_ACCESS_TOKEN environment variable is missing.',
      });
    }

    try {
      const summary = await ouraClient.getDailySummary();

      if (!summary.readiness) {
        return JSON.stringify({
          success: true,
          message: 'No readiness data available yet today. The Oura Ring may not have synced yet.',
          readiness: null,
        });
      }

      const r = summary.readiness;
      return JSON.stringify({
        success: true,
        readiness: {
          date: r.date,
          readinessScore: r.readinessScore,
          restingHeartRate: `${r.restingHeartRate} bpm`,
          hrvBalance: r.hrvBalance,
          bodyTemperatureDeviation: `${r.temperatureDeviation > 0 ? '+' : ''}${r.temperatureDeviation.toFixed(1)}°C`,
          recoveryIndex: r.recoveryIndex,
          sleepBalance: r.sleepBalance,
          previousDayActivity: r.previousDayActivity,
        },
      });
    } catch (error) {
      return JSON.stringify(createToolError('oura_readiness', error));
    }
  },
});

// =============================================================================
// oura_bio_rhythm
// =============================================================================

const ouraBioRhythmSchema = z.object({});

export const ouraBioRhythmTool = tool({
  name: 'oura_bio_rhythm',
  description:
    'Get the user\'s current bio-rhythm state derived from Oura Ring data. Returns energy level, ' +
    'recovery status, combined score, and recommended lighting settings based on sleep and readiness.',
  parameters: ouraBioRhythmSchema,
  execute: async () => {
    if (!ouraClient.isConfigured()) {
      return JSON.stringify({
        success: false,
        message: 'Oura Ring is not configured. The OURA_PERSONAL_ACCESS_TOKEN environment variable is missing.',
      });
    }

    try {
      const bioRhythm = await getBioRhythmState();

      if (!bioRhythm) {
        return JSON.stringify({
          success: false,
          message: 'Could not calculate bio-rhythm. Oura data may not be available.',
        });
      }

      return JSON.stringify({
        success: true,
        bioRhythm: {
          energyLevel: bioRhythm.energyLevel,
          recoveryStatus: bioRhythm.recoveryStatus,
          sleepScore: bioRhythm.sleepScore,
          readinessScore: bioRhythm.readinessScore,
          combinedScore: bioRhythm.combinedScore,
          lighting: {
            preset: bioRhythm.lightingPreset.name,
            colorTemperature: `${bioRhythm.colorTemperature}K`,
            brightness: `${bioRhythm.brightness}%`,
            reason: bioRhythm.lightingPreset.description,
          },
          calculatedAt: bioRhythm.calculatedAt,
        },
      });
    } catch (error) {
      return JSON.stringify(createToolError('oura_bio_rhythm', error));
    }
  },
});

// =============================================================================
// Export all Oura tools
// =============================================================================

export const ouraTools = [
  ouraSleepSummaryTool,
  ouraReadinessTool,
  ouraBioRhythmTool,
] as Tool[];
