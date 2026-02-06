/**
 * Tests for Agent Definitions (@openai/agents SDK)
 * Validates all Agent instances, tools, handoffs, and helper functions
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Agent as AgentType_SDK } from '@openai/agents';

// Mock model-provider before importing agents (requires API keys in real use)
vi.mock('@/lib/agents/sdk/model-provider', () => ({
  getAgentModel: vi.fn(() => 'gpt-4.1'), // Return string model name (SDK default)
}));

// Now import the module under test
import {
  AgentTypeSchema,
  orchestratorAgent,
  coderAgent,
  researcherAgent,
  secretaryAgent,
  personalityAgent,
  homeAgent,
  financeAgent,
  imagegenAgent,
  getAgent,
  getAgentName,
  getHandoffTargets,
  isValidAgentType,
  getAllAgents,
  getAgentByName,
  getAgentType,
  type AgentType,
} from '@/lib/agents/sdk/agents';
import { defaultTools } from '@/lib/agents/sdk/tools/default';
import { githubTools } from '@/lib/agents/sdk/tools/github';
import { spotifyTools } from '@/lib/agents/sdk/tools/spotify';

// =============================================================================
// Agent Type Schema Tests
// =============================================================================

describe('AgentTypeSchema', () => {
  it('should accept all valid agent types', () => {
    const validTypes = [
      'orchestrator',
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    validTypes.forEach((type) => {
      expect(AgentTypeSchema.safeParse(type).success).toBe(true);
    });
  });

  it('should reject invalid agent types', () => {
    const invalidTypes = ['invalid', 'unknown', 'helper', '', null, undefined, 123];

    invalidTypes.forEach((type) => {
      expect(AgentTypeSchema.safeParse(type).success).toBe(false);
    });
  });
});

// =============================================================================
// Agent Instance Structure Tests
// =============================================================================

describe('agent instances', () => {
  it('should have exactly 8 agents', () => {
    const allAgents = getAllAgents();
    expect(allAgents).toHaveLength(8);
  });

  it('should all be Agent instances with required properties', () => {
    const allAgents = getAllAgents();
    allAgents.forEach((agent) => {
      expect(agent.name).toBeDefined();
      expect(typeof agent.name).toBe('string');
      expect(agent.name.length).toBeGreaterThan(0);

      expect(agent.instructions).toBeDefined();
      expect(typeof agent.instructions).toBe('string');
      expect((agent.instructions as string).length).toBeGreaterThan(100);

      expect(agent.tools).toBeDefined();
      expect(Array.isArray(agent.tools)).toBe(true);

      expect(agent.model).toBeDefined();
    });
  });

  it('should all have unique names', () => {
    const allAgents = getAllAgents();
    const names = allAgents.map((a) => a.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// =============================================================================
// Orchestrator Agent Tests
// =============================================================================

describe('orchestrator agent', () => {
  it('should have correct name', () => {
    expect(orchestratorAgent.name).toBe('Q8');
  });

  it('should have handoffs to all specialist agents', () => {
    expect(orchestratorAgent.handoffs).toBeDefined();
    expect(orchestratorAgent.handoffs).toHaveLength(7);

    const handoffNames = orchestratorAgent.handoffs.map((h) => {
      // Handoff objects have an .agent property
      return 'agent' in h ? h.agent.name : h.name;
    });
    expect(handoffNames).toContain('DevBot');
    expect(handoffNames).toContain('ResearchBot');
    expect(handoffNames).toContain('SecretaryBot');
    expect(handoffNames).toContain('PersonalityBot');
    expect(handoffNames).toContain('HomeBot');
    expect(handoffNames).toContain('FinanceAdvisor');
    expect(handoffNames).toContain('ImageGen');
  });

  it('should not hand off to itself', () => {
    const handoffNames = orchestratorAgent.handoffs.map((h) => {
      return 'agent' in h ? h.agent.name : h.name;
    });
    expect(handoffNames).not.toContain('Q8');
  });

  it('should have default tools', () => {
    expect(orchestratorAgent.tools.length).toBeGreaterThan(0);
    const toolNames = orchestratorAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions mentioning delegation', () => {
    const instructions = orchestratorAgent.instructions as string;
    expect(instructions).toContain('delegate');
    expect(instructions).toContain('Coder');
    expect(instructions).toContain('Researcher');
    expect(instructions).toContain('Secretary');
  });

  it('should have handoff description', () => {
    expect(orchestratorAgent.handoffDescription).toBeDefined();
    expect(orchestratorAgent.handoffDescription.length).toBeGreaterThan(0);
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(orchestratorAgent.modelSettings.temperature).toBeUndefined();
  });
});

// =============================================================================
// Coder Agent Tests
// =============================================================================

describe('coder agent', () => {
  it('should have correct name', () => {
    expect(coderAgent.name).toBe('DevBot');
  });

  it('should have github tools', () => {
    const toolNames = coderAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('github_list_repos');
    expect(toolNames).toContain('github_get_repo');
    expect(toolNames).toContain('github_list_issues');
    expect(toolNames).toContain('github_create_issue');
    expect(toolNames).toContain('github_list_prs');
    expect(toolNames).toContain('github_get_pr');
    expect(toolNames).toContain('github_create_pr');
    expect(toolNames).toContain('github_search_code');
  });

  it('should have default tools', () => {
    const toolNames = coderAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
  });

  it('should not have handoffs (specialist agent)', () => {
    expect(coderAgent.handoffs).toHaveLength(0);
  });

  it('should have instructions about GitHub and code', () => {
    const instructions = coderAgent.instructions as string;
    expect(instructions).toContain('GitHub');
    expect(instructions).toContain('code');
    expect(instructions).toContain('Extended Thinking');
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(coderAgent.modelSettings.temperature).toBeUndefined();
  });

  it('should have handoff description', () => {
    expect(coderAgent.handoffDescription).toContain('code');
  });
});

// =============================================================================
// Researcher Agent Tests
// =============================================================================

describe('researcher agent', () => {
  it('should have correct name', () => {
    expect(researcherAgent.name).toBe('ResearchBot');
  });

  it('should have default tools and hosted web search', () => {
    const toolNames = researcherAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
    expect(toolNames).toContain('web_search');
  });

  it('should have instructions about citations and research', () => {
    const instructions = researcherAgent.instructions as string;
    expect(instructions).toContain('cite');
    expect(instructions).toContain('sources');
    expect(instructions).toContain('research');
    expect(instructions).toContain('fact');
  });
});

// =============================================================================
// Secretary Agent Tests
// =============================================================================

describe('secretary agent', () => {
  it('should have correct name', () => {
    expect(secretaryAgent.name).toBe('SecretaryBot');
  });

  it('should have Google Workspace tools and default tools', () => {
    const toolNames = secretaryAgent.tools.map((t) => t.name);
    // Google tools
    expect(toolNames).toContain('google_list_calendars');
    expect(toolNames).toContain('google_list_events');
    expect(toolNames).toContain('google_create_event');
    expect(toolNames).toContain('google_send_email');
    expect(toolNames).toContain('google_search_drive');
    // Default tools
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions about email and calendar', () => {
    const instructions = secretaryAgent.instructions as string;
    expect(instructions).toContain('Email');
    expect(instructions).toContain('Calendar');
    expect(instructions).toContain('scheduling');
  });
});

// =============================================================================
// Personality Agent Tests
// =============================================================================

describe('personality agent', () => {
  it('should have correct name', () => {
    expect(personalityAgent.name).toBe('PersonalityBot');
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(personalityAgent.modelSettings.temperature).toBeUndefined();
  });

  it('should have spotify tools', () => {
    const toolNames = personalityAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('spotify_search');
    expect(toolNames).toContain('spotify_now_playing');
    expect(toolNames).toContain('spotify_play_pause');
    expect(toolNames).toContain('spotify_next_previous');
    expect(toolNames).toContain('spotify_add_to_queue');
    expect(toolNames).toContain('spotify_get_devices');
    expect(toolNames).toContain('spotify_set_volume');
  });

  it('should have default tools', () => {
    const toolNames = personalityAgent.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions about Spotify and entertainment', () => {
    const instructions = personalityAgent.instructions as string;
    expect(instructions).toContain('Spotify');
    expect(instructions).toContain('music');
    expect(instructions).toContain('USE THE TOOLS');
  });
});

// =============================================================================
// Home Agent Tests
// =============================================================================

describe('home agent', () => {
  it('should have correct name', () => {
    expect(homeAgent.name).toBe('HomeBot');
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(homeAgent.modelSettings.temperature).toBeUndefined();
  });

  it('should have Home Assistant tools and default tools', () => {
    const toolNames = homeAgent.tools.map((t) => t.name);
    // Home tools
    expect(toolNames).toContain('home_get_states');
    expect(toolNames).toContain('home_control_device');
    expect(toolNames).toContain('home_set_light');
    expect(toolNames).toContain('home_set_climate');
    expect(toolNames).toContain('home_activate_scene');
    expect(toolNames).toContain('home_control_cover');
    // Default tools
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions about safety', () => {
    const instructions = homeAgent.instructions as string;
    expect(instructions).toContain('Safety');
    expect(instructions).toContain('confirm');
    expect(instructions).toContain('unlock');
  });
});

// =============================================================================
// Finance Agent Tests
// =============================================================================

describe('finance agent', () => {
  it('should have correct name', () => {
    expect(financeAgent.name).toBe('FinanceAdvisor');
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(financeAgent.modelSettings.temperature).toBeUndefined();
  });

  it('should have finance tools and default tools', () => {
    const toolNames = financeAgent.tools.map((t) => t.name);
    // Finance tools
    expect(toolNames).toContain('finance_get_accounts');
    expect(toolNames).toContain('finance_get_transactions');
    expect(toolNames).toContain('finance_spending_summary');
    expect(toolNames).toContain('finance_upcoming_bills');
    expect(toolNames).toContain('finance_net_worth');
    // Default tools
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions about privacy and financial advice', () => {
    const instructions = financeAgent.instructions as string;
    expect(instructions).toContain('privacy');
    expect(instructions).toContain('financial');
    expect(instructions).toContain('Spending');
  });
});

// =============================================================================
// ImageGen Agent Tests
// =============================================================================

describe('imagegen agent', () => {
  it('should have correct name', () => {
    expect(imagegenAgent.name).toBe('ImageGen');
  });

  it('should have hosted image generation tool and default tools', () => {
    const toolNames = imagegenAgent.tools.map((t) => t.name);
    // Hosted image generation
    expect(toolNames).toContain('image_generation');
    // Default tools
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should not have temperature (not supported by Responses API)', () => {
    expect(imagegenAgent.modelSettings.temperature).toBeUndefined();
  });

  it('should have instructions about image generation', () => {
    const instructions = (imagegenAgent.instructions as string).toLowerCase();
    expect(instructions).toContain('image');
    expect(instructions).toContain('generate');
    expect(instructions).toContain('style');
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('getAgent', () => {
  it('should return correct agent for valid type', () => {
    const agent = getAgent('coder');
    expect(agent.name).toBe('DevBot');
  });

  it('should throw for invalid agent type', () => {
    expect(() => getAgent('invalid' as AgentType)).toThrow('Unknown agent type');
  });

  it('should return agent instances for all types', () => {
    const types: AgentType[] = [
      'orchestrator', 'coder', 'researcher', 'secretary',
      'personality', 'home', 'finance', 'imagegen',
    ];
    types.forEach((type) => {
      const agent = getAgent(type);
      expect(agent).toBeDefined();
      expect(agent.name).toBeDefined();
    });
  });
});

describe('getAgentName', () => {
  it('should return display name for each agent', () => {
    expect(getAgentName('orchestrator')).toBe('Q8');
    expect(getAgentName('coder')).toBe('DevBot');
    expect(getAgentName('researcher')).toBe('ResearchBot');
    expect(getAgentName('secretary')).toBe('SecretaryBot');
    expect(getAgentName('personality')).toBe('PersonalityBot');
    expect(getAgentName('home')).toBe('HomeBot');
    expect(getAgentName('finance')).toBe('FinanceAdvisor');
    expect(getAgentName('imagegen')).toBe('ImageGen');
  });
});

describe('getHandoffTargets', () => {
  it('should return all specialist agents', () => {
    const targets = getHandoffTargets();
    expect(targets).toHaveLength(7);
    expect(targets).toContain('coder');
    expect(targets).toContain('researcher');
    expect(targets).toContain('secretary');
    expect(targets).toContain('personality');
    expect(targets).toContain('home');
    expect(targets).toContain('finance');
    expect(targets).toContain('imagegen');
  });

  it('should not include orchestrator', () => {
    const targets = getHandoffTargets();
    expect(targets).not.toContain('orchestrator');
  });
});

describe('isValidAgentType', () => {
  it('should return true for valid types', () => {
    expect(isValidAgentType('orchestrator')).toBe(true);
    expect(isValidAgentType('coder')).toBe(true);
    expect(isValidAgentType('imagegen')).toBe(true);
  });

  it('should return false for invalid types', () => {
    expect(isValidAgentType('invalid')).toBe(false);
    expect(isValidAgentType('')).toBe(false);
    expect(isValidAgentType('CODER')).toBe(false); // Case sensitive
  });
});

describe('getAllAgents', () => {
  it('should return all 8 agents', () => {
    const agents = getAllAgents();
    expect(agents).toHaveLength(8);
  });

  it('should return Agent instances with names', () => {
    const agents = getAllAgents();
    agents.forEach((agent) => {
      expect(agent.name).toBeDefined();
      expect(agent.instructions).toBeDefined();
      expect(agent.tools).toBeDefined();
    });
  });
});

describe('getAgentByName', () => {
  it('should find agent by exact name', () => {
    const agent = getAgentByName('DevBot');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('DevBot');
  });

  it('should find agent by name case-insensitively', () => {
    expect(getAgentByName('devbot')?.name).toBe('DevBot');
    expect(getAgentByName('DEVBOT')?.name).toBe('DevBot');
    expect(getAgentByName('DevBot')?.name).toBe('DevBot');
  });

  it('should return undefined for unknown name', () => {
    expect(getAgentByName('UnknownBot')).toBeUndefined();
  });

  it('should find Q8 orchestrator', () => {
    const agent = getAgentByName('Q8');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Q8');
  });
});

describe('getAgentType', () => {
  it('should return correct type for each agent', () => {
    expect(getAgentType(orchestratorAgent)).toBe('orchestrator');
    expect(getAgentType(coderAgent)).toBe('coder');
    expect(getAgentType(researcherAgent)).toBe('researcher');
    expect(getAgentType(secretaryAgent)).toBe('secretary');
    expect(getAgentType(personalityAgent)).toBe('personality');
    expect(getAgentType(homeAgent)).toBe('home');
    expect(getAgentType(financeAgent)).toBe('finance');
    expect(getAgentType(imagegenAgent)).toBe('imagegen');
  });
});

// =============================================================================
// Tool Assignment Validation Tests
// =============================================================================

describe('tool assignments', () => {
  it('coder should have all github tools', () => {
    const coderToolNames = coderAgent.tools.map((t) => t.name);
    githubTools.forEach((githubTool) => {
      expect(coderToolNames).toContain(githubTool.name);
    });
  });

  it('personality should have all spotify tools', () => {
    const personalityToolNames = personalityAgent.tools.map((t) => t.name);
    spotifyTools.forEach((spotifyTool) => {
      expect(personalityToolNames).toContain(spotifyTool.name);
    });
  });

  it('all agents except imagegen should have default tools', () => {
    const agentsWithDefaults = [
      orchestratorAgent,
      coderAgent,
      researcherAgent,
      secretaryAgent,
      personalityAgent,
      homeAgent,
      financeAgent,
    ];

    agentsWithDefaults.forEach((agent) => {
      const toolNames = agent.tools.map((t) => t.name);
      defaultTools.forEach((defaultTool) => {
        expect(toolNames).toContain(defaultTool.name);
      });
    });
  });

  it('only orchestrator should have handoffs', () => {
    const allAgents = getAllAgents();
    allAgents.forEach((agent) => {
      if (agent.name === 'Q8') {
        expect(agent.handoffs.length).toBeGreaterThan(0);
      } else {
        expect(agent.handoffs).toHaveLength(0);
      }
    });
  });
});

// =============================================================================
// Model Settings Validation Tests
// =============================================================================

describe('model settings', () => {
  it('no agents should have temperature (not supported by Responses API)', () => {
    const allAgents = getAllAgents();
    allAgents.forEach((agent) => {
      expect(agent.modelSettings.temperature).toBeUndefined();
    });
  });
});
