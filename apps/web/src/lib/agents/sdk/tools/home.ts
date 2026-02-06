/**
 * Home Assistant Direct API Tools
 * Direct integration with Home Assistant REST API for smart home control
 * Assigned to: Home Agent (GPT-5-mini)
 *
 * Uses @openai/agents tool() for native SDK integration.
 * Auth: HASS_URL + HASS_TOKEN env vars (no per-user auth needed)
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import { createToolError } from '../utils/errors';
import { logger } from '@/lib/logger';

// =============================================================================
// Constants
// =============================================================================

const HASS_URL = process.env.HASS_URL || 'http://homeassistant.local:8123';
const HASS_TOKEN = process.env.HASS_TOKEN;

// All known entity IDs from SmartHomeWidget
const ENTITY_DESCRIPTIONS = `Known entities:
Lights: light.bedroom_group, light.bedside, light.elk_bledom02 (bedroom LED), light.elk_bledom0c (desk LED), light.kitchen_bar, light.entry, light.entertainment
Switches: switch.bathroom, switch.kitchen, switch.sync_box_power, switch.sync_box_light_sync, switch.sync_box_dolby_vision_compatibility, switch.sonos_crossfade, switch.sonos_loudness
Climate: climate.simon_aire_inc
Scenes: scene.entertainment_relax, scene.entertainment_bright, scene.entertainment_natural_light_2, scene.entertainment_dimmed, scene.entertainment_rest, scene.entertainment_nightlight, scene.all_lights_off
Covers: cover.left_blind, cover.right_blind
Media: media_player.living_room (Apple TV), media_player.sonos
Selectors: select.sync_box_hdmi_input, select.sync_box_sync_mode, select.sync_box_intensity, input_select.remote_pad_mode
Numbers: number.sync_box_brightness, number.sonos_audio_delay, number.sonos_balance, number.sonos_bass
Remotes: remote.living_room (Apple TV), remote.tv_samsung_7_series_65 (Samsung TV)`;

// =============================================================================
// HA API Helper
// =============================================================================

function hasCredentials(): boolean {
  return !!HASS_TOKEN;
}

async function hassApi(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  if (!HASS_TOKEN) {
    logger.error('[Home Assistant] HASS_TOKEN not configured');
    throw new Error('Home Assistant token not configured (HASS_TOKEN)');
  }

  const url = `${HASS_URL}/api${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${HASS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (fetchError) {
    logger.error('[Home Assistant] Connection failed', {
      url,
      error: fetchError instanceof Error ? fetchError.message : String(fetchError),
    });
    throw new Error(`Home Assistant unreachable at ${HASS_URL} — ${fetchError instanceof Error ? fetchError.message : 'connection failed'}`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    logger.error('[Home Assistant] API error', {
      endpoint,
      status: res.status,
      statusText: res.statusText,
      body: errorBody.slice(0, 500),
    });
    throw new Error(`HA API: ${res.status} ${res.statusText}`);
  }

  return res.status === 204 ? null : res.json();
}

function missingCredentialsResult(): string {
  return JSON.stringify({
    success: false,
    message: 'Home Assistant not configured. Set HASS_URL and HASS_TOKEN environment variables.',
  });
}

// =============================================================================
// home_get_states
// =============================================================================

const homeGetStatesSchema = z.object({
  entity_ids: z.array(z.string()).nullable().describe(
    'Specific entity IDs to query. If empty, returns all entities.'
  ),
  domain: z.string().nullable().describe(
    'Filter by domain (e.g., "light", "switch", "climate", "media_player")'
  ),
});

export const homeGetStatesTool = tool({
  name: 'home_get_states',
  description: `Get the current state of one or more Home Assistant entities. ${ENTITY_DESCRIPTIONS}`,
  parameters: homeGetStatesSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      if (args.entity_ids && args.entity_ids.length > 0) {
        const states = await Promise.all(
          args.entity_ids.map(id => hassApi(`/states/${id}`))
        );
        return JSON.stringify({ success: true, states });
      }

      const allStates = await hassApi('/states') as Array<{ entity_id: string }>;

      if (args.domain) {
        const filtered = allStates.filter(
          (s) => s.entity_id.startsWith(`${args.domain}.`)
        );
        return JSON.stringify({ success: true, states: filtered });
      }

      return JSON.stringify({ success: true, states: allStates });
    } catch (error) {
      return JSON.stringify(createToolError('home_get_states', error));
    }
  },
});

// =============================================================================
// home_control_device
// =============================================================================

const homeControlDeviceSchema = z.object({
  entity_id: z.string().describe('The entity ID to control (e.g., "light.bedroom_group")'),
  action: z.enum(['turn_on', 'turn_off', 'toggle']).describe('The action to perform'),
});

export const homeControlDeviceTool = tool({
  name: 'home_control_device',
  description: `Turn on, off, or toggle any light, switch, fan, or media_player. ${ENTITY_DESCRIPTIONS}`,
  parameters: homeControlDeviceSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      const domain = args.entity_id.split('.')[0];
      await hassApi(`/services/${domain}/${args.action}`, 'POST', {
        entity_id: args.entity_id,
      });

      return JSON.stringify({
        success: true,
        message: `${args.action.replace('_', ' ')} ${args.entity_id}`,
      });
    } catch (error) {
      return JSON.stringify(createToolError('home_control_device', error));
    }
  },
});

// =============================================================================
// home_set_light
// =============================================================================

const homeSetLightSchema = z.object({
  entity_id: z.string().describe('The light entity ID (e.g., "light.bedroom_group")'),
  brightness: z.number().min(0).max(255).nullable().describe('Brightness 0-255'),
  color_temp_kelvin: z.number().nullable().describe('Color temperature in Kelvin (2700-6500)'),
  rgb_r: z.number().min(0).max(255).nullable().describe('Red channel 0-255'),
  rgb_g: z.number().min(0).max(255).nullable().describe('Green channel 0-255'),
  rgb_b: z.number().min(0).max(255).nullable().describe('Blue channel 0-255'),
});

export const homeSetLightTool = tool({
  name: 'home_set_light',
  description: 'Set brightness, color temperature, or RGB color on a light. Turns the light on automatically.',
  parameters: homeSetLightSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      const serviceData: Record<string, unknown> = {
        entity_id: args.entity_id,
      };
      if (args.brightness != null) serviceData.brightness = args.brightness;
      if (args.color_temp_kelvin != null) serviceData.color_temp_kelvin = args.color_temp_kelvin;
      if (args.rgb_r != null && args.rgb_g != null && args.rgb_b != null) {
        serviceData.rgb_color = [args.rgb_r, args.rgb_g, args.rgb_b];
      }

      await hassApi('/services/light/turn_on', 'POST', serviceData);

      return JSON.stringify({
        success: true,
        message: `Set ${args.entity_id}: ${Object.entries(serviceData).filter(([k]) => k !== 'entity_id').map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`,
      });
    } catch (error) {
      return JSON.stringify(createToolError('home_set_light', error));
    }
  },
});

// =============================================================================
// home_set_climate
// =============================================================================

const homeSetClimateSchema = z.object({
  entity_id: z.string().default('climate.simon_aire_inc').describe('Climate entity ID'),
  temperature: z.number().nullable().describe('Target temperature in Fahrenheit'),
  hvac_mode: z.enum(['off', 'heat', 'cool', 'heat_cool', 'auto', 'fan_only']).nullable().describe('HVAC mode'),
  fan_mode: z.enum(['auto', 'low', 'medium', 'high']).nullable().describe('Fan mode'),
});

export const homeSetClimateTool = tool({
  name: 'home_set_climate',
  description: 'Set thermostat temperature, HVAC mode, or fan mode. Default entity: climate.simon_aire_inc',
  parameters: homeSetClimateSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      if (args.hvac_mode) {
        await hassApi('/services/climate/set_hvac_mode', 'POST', {
          entity_id: args.entity_id,
          hvac_mode: args.hvac_mode,
        });
      }

      if (args.temperature != null) {
        await hassApi('/services/climate/set_temperature', 'POST', {
          entity_id: args.entity_id,
          temperature: args.temperature,
        });
      }

      if (args.fan_mode) {
        await hassApi('/services/climate/set_fan_mode', 'POST', {
          entity_id: args.entity_id,
          fan_mode: args.fan_mode,
        });
      }

      return JSON.stringify({
        success: true,
        message: `Climate updated: ${[
          args.hvac_mode && `mode=${args.hvac_mode}`,
          args.temperature != null && `temp=${args.temperature}°F`,
          args.fan_mode && `fan=${args.fan_mode}`,
        ].filter(Boolean).join(', ')}`,
      });
    } catch (error) {
      return JSON.stringify(createToolError('home_set_climate', error));
    }
  },
});

// =============================================================================
// home_activate_scene
// =============================================================================

const homeActivateSceneSchema = z.object({
  scene_id: z.string().describe(
    'Scene entity ID (e.g., "scene.entertainment_relax", "scene.all_lights_off")'
  ),
});

export const homeActivateSceneTool = tool({
  name: 'home_activate_scene',
  description: `Activate a Home Assistant scene. Available scenes: scene.entertainment_relax, scene.entertainment_bright, scene.entertainment_natural_light_2, scene.entertainment_dimmed, scene.entertainment_rest, scene.entertainment_nightlight, scene.all_lights_off`,
  parameters: homeActivateSceneSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      await hassApi('/services/scene/turn_on', 'POST', {
        entity_id: args.scene_id,
      });

      return JSON.stringify({
        success: true,
        message: `Activated scene: ${args.scene_id}`,
      });
    } catch (error) {
      return JSON.stringify(createToolError('home_activate_scene', error));
    }
  },
});

// =============================================================================
// home_control_cover
// =============================================================================

const homeControlCoverSchema = z.object({
  entity_id: z.string().describe('Cover entity ID: "cover.left_blind" or "cover.right_blind"'),
  action: z.enum(['open', 'close', 'stop', 'set_position']).describe('Action to perform'),
  position: z.number().min(0).max(100).nullable().describe('Position 0 (closed) to 100 (open). Only for set_position action.'),
});

export const homeControlCoverTool = tool({
  name: 'home_control_cover',
  description: 'Open, close, or set position of blinds/covers. Available: cover.left_blind, cover.right_blind',
  parameters: homeControlCoverSchema,
  execute: async (args) => {
    if (!hasCredentials()) return missingCredentialsResult();

    try {
      if (args.action === 'set_position') {
        await hassApi('/services/cover/set_cover_position', 'POST', {
          entity_id: args.entity_id,
          position: args.position ?? 50,
        });
      } else {
        const service = args.action === 'open' ? 'open_cover'
          : args.action === 'close' ? 'close_cover'
          : 'stop_cover';
        await hassApi(`/services/cover/${service}`, 'POST', {
          entity_id: args.entity_id,
        });
      }

      return JSON.stringify({
        success: true,
        message: `Cover ${args.entity_id}: ${args.action}${args.position != null ? ` to ${args.position}%` : ''}`,
      });
    } catch (error) {
      return JSON.stringify(createToolError('home_control_cover', error));
    }
  },
});

// =============================================================================
// Export all Home tools
// =============================================================================

export const homeTools: Tool[] = [
  homeGetStatesTool,
  homeControlDeviceTool,
  homeSetLightTool,
  homeSetClimateTool,
  homeActivateSceneTool,
  homeControlCoverTool,
];
