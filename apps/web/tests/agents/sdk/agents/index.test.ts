/**
 * Tests for Agent Configurations
 * Validates all agent definitions, tools, and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  AgentTypeSchema,
  agentConfigs,
  getAgentConfig,
  getAgentTools,
  getAgentModel,
  getAgentName,
  getHandoffTargets,
  isValidAgentType,
  getAllAgentConfigs,
  getAgentByName,
  type AgentType,
  type AgentConfig,
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
// Agent Configuration Structure Tests
// =============================================================================

describe('agentConfigs structure', () => {
  it('should have exactly 8 agent configurations', () => {
    expect(Object.keys(agentConfigs)).toHaveLength(8);
  });

  it('should have all required agent types', () => {
    const requiredTypes: AgentType[] = [
      'orchestrator',
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    requiredTypes.forEach((type) => {
      expect(agentConfigs[type]).toBeDefined();
    });
  });

  it('each agent should have all required fields', () => {
    Object.entries(agentConfigs).forEach(([type, config]) => {
      expect(config.name).toBeDefined();
      expect(typeof config.name).toBe('string');
      expect(config.name.length).toBeGreaterThan(0);

      expect(config.type).toBe(type);

      expect(config.model).toBeDefined();
      expect(typeof config.model).toBe('string');
      expect(config.model.length).toBeGreaterThan(0);

      expect(config.instructions).toBeDefined();
      expect(typeof config.instructions).toBe('string');
      expect(config.instructions.length).toBeGreaterThan(100);

      expect(config.tools).toBeDefined();
      expect(Array.isArray(config.tools)).toBe(true);
    });
  });
});

// =============================================================================
// Orchestrator Configuration Tests
// =============================================================================

describe('orchestrator agent', () => {
  const config = agentConfigs.orchestrator;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('Q8');
    expect(config.type).toBe('orchestrator');
    expect(config.model).toBe('gpt-5.2');
  });

  it('should have handoffs to all specialist agents', () => {
    expect(config.handoffs).toBeDefined();
    expect(config.handoffs).toContain('coder');
    expect(config.handoffs).toContain('researcher');
    expect(config.handoffs).toContain('secretary');
    expect(config.handoffs).toContain('personality');
    expect(config.handoffs).toContain('home');
    expect(config.handoffs).toContain('finance');
    expect(config.handoffs).toContain('imagegen');
    expect(config.handoffs).toHaveLength(7);
  });

  it('should not hand off to itself', () => {
    expect(config.handoffs).not.toContain('orchestrator');
  });

  it('should have default tools', () => {
    expect(config.tools.length).toBeGreaterThan(0);
    const toolNames = config.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions mentioning delegation', () => {
    expect(config.instructions).toContain('delegate');
    expect(config.instructions).toContain('Coder');
    expect(config.instructions).toContain('Researcher');
    expect(config.instructions).toContain('Secretary');
  });
});

// =============================================================================
// Coder Agent Configuration Tests
// =============================================================================

describe('coder agent', () => {
  const config = agentConfigs.coder;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('DevBot');
    expect(config.type).toBe('coder');
    expect(config.model).toBe('claude-opus-4-5-20251101');
  });

  it('should have extended thinking enabled', () => {
    expect(config.modelOptions?.extendedThinking).toBe(true);
  });

  it('should have github tools', () => {
    const toolNames = config.tools.map((t) => t.name);
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
    const toolNames = config.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
  });

  it('should not have handoffs (specialized agent)', () => {
    expect(config.handoffs).toBeUndefined();
  });

  it('should have instructions about GitHub and code', () => {
    expect(config.instructions).toContain('GitHub');
    expect(config.instructions).toContain('code');
    expect(config.instructions).toContain('Extended Thinking');
  });
});

// =============================================================================
// Researcher Agent Configuration Tests
// =============================================================================

describe('researcher agent', () => {
  const config = agentConfigs.researcher;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('ResearchBot');
    expect(config.type).toBe('researcher');
    expect(config.model).toBe('sonar-reasoning-pro');
  });

  it('should have default tools only (search built into model)', () => {
    expect(config.tools).toEqual(defaultTools);
  });

  it('should have instructions about citations and research', () => {
    expect(config.instructions).toContain('cite');
    expect(config.instructions).toContain('sources');
    expect(config.instructions).toContain('research');
    expect(config.instructions).toContain('fact');
  });
});

// =============================================================================
// Secretary Agent Configuration Tests
// =============================================================================

describe('secretary agent', () => {
  const config = agentConfigs.secretary;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('SecretaryBot');
    expect(config.type).toBe('secretary');
    expect(config.model).toBe('gemini-3-flash-preview');
  });

  it('should have default tools (Google tools TBD)', () => {
    expect(config.tools).toEqual(defaultTools);
  });

  it('should have instructions about email and calendar', () => {
    expect(config.instructions).toContain('Email');
    expect(config.instructions).toContain('Calendar');
    expect(config.instructions).toContain('scheduling');
  });
});

// =============================================================================
// Personality Agent Configuration Tests
// =============================================================================

describe('personality agent', () => {
  const config = agentConfigs.personality;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('PersonalityBot');
    expect(config.type).toBe('personality');
    expect(config.model).toBe('grok-4-1-fast');
  });

  it('should have high temperature for creativity', () => {
    expect(config.modelOptions?.temperature).toBe(0.9);
  });

  it('should have spotify tools', () => {
    const toolNames = config.tools.map((t) => t.name);
    expect(toolNames).toContain('spotify_search');
    expect(toolNames).toContain('spotify_now_playing');
    expect(toolNames).toContain('spotify_play_pause');
    expect(toolNames).toContain('spotify_next_previous');
    expect(toolNames).toContain('spotify_add_to_queue');
    expect(toolNames).toContain('spotify_get_devices');
    expect(toolNames).toContain('spotify_set_volume');
  });

  it('should have default tools', () => {
    const toolNames = config.tools.map((t) => t.name);
    expect(toolNames).toContain('getCurrentDatetime');
    expect(toolNames).toContain('calculate');
    expect(toolNames).toContain('getWeather');
  });

  it('should have instructions about Spotify and entertainment', () => {
    expect(config.instructions).toContain('Spotify');
    expect(config.instructions).toContain('music');
    expect(config.instructions).toContain('USE THE TOOLS');
  });
});

// =============================================================================
// Home Agent Configuration Tests
// =============================================================================

describe('home agent', () => {
  const config = agentConfigs.home;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('HomeBot');
    expect(config.type).toBe('home');
    expect(config.model).toBe('gpt-5-mini');
  });

  it('should have low temperature for reliability', () => {
    expect(config.modelOptions?.temperature).toBe(0.3);
  });

  it('should have default tools (Home Assistant tools TBD)', () => {
    expect(config.tools).toEqual(defaultTools);
  });

  it('should have instructions about safety', () => {
    expect(config.instructions).toContain('Safety');
    expect(config.instructions).toContain('confirm');
    expect(config.instructions).toContain('unlock');
  });
});

// =============================================================================
// Finance Agent Configuration Tests
// =============================================================================

describe('finance agent', () => {
  const config = agentConfigs.finance;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('FinanceAdvisor');
    expect(config.type).toBe('finance');
    expect(config.model).toBe('gemini-3-flash-preview');
  });

  it('should have low temperature for accuracy', () => {
    expect(config.modelOptions?.temperature).toBe(0.3);
  });

  it('should have default tools (Square tools TBD)', () => {
    expect(config.tools).toEqual(defaultTools);
  });

  it('should have instructions about privacy and financial advice', () => {
    expect(config.instructions).toContain('privacy');
    expect(config.instructions).toContain('financial');
    expect(config.instructions).toContain('Spending');
  });
});

// =============================================================================
// ImageGen Agent Configuration Tests
// =============================================================================

describe('imagegen agent', () => {
  const config = agentConfigs.imagegen;

  it('should have correct basic configuration', () => {
    expect(config.name).toBe('ImageGen');
    expect(config.type).toBe('imagegen');
    expect(config.model).toBe('gpt-image-1.5');
  });

  it('should have no tools (uses native image generation)', () => {
    expect(config.tools).toHaveLength(0);
  });

  it('should have high temperature for creativity', () => {
    expect(config.modelOptions?.temperature).toBe(0.8);
  });

  it('should have instructions about image generation', () => {
    expect(config.instructions.toLowerCase()).toContain('image');
    expect(config.instructions.toLowerCase()).toContain('generate');
    expect(config.instructions.toLowerCase()).toContain('style');
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('getAgentConfig', () => {
  it('should return correct config for valid agent type', () => {
    const config = getAgentConfig('coder');
    expect(config.name).toBe('DevBot');
    expect(config.model).toBe('claude-opus-4-5-20251101');
  });

  it('should throw for invalid agent type', () => {
    expect(() => getAgentConfig('invalid' as AgentType)).toThrow('Unknown agent type');
  });
});

describe('getAgentTools', () => {
  it('should return tools for an agent', () => {
    const tools = getAgentTools('coder');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === 'github_list_repos')).toBe(true);
  });

  it('should return empty array for imagegen', () => {
    const tools = getAgentTools('imagegen');
    expect(tools).toHaveLength(0);
  });
});

describe('getAgentModel', () => {
  it('should return correct model for each agent', () => {
    expect(getAgentModel('orchestrator')).toBe('gpt-5.2');
    expect(getAgentModel('coder')).toBe('claude-opus-4-5-20251101');
    expect(getAgentModel('researcher')).toBe('sonar-reasoning-pro');
    expect(getAgentModel('secretary')).toBe('gemini-3-flash-preview');
    expect(getAgentModel('personality')).toBe('grok-4-1-fast');
    expect(getAgentModel('home')).toBe('gpt-5-mini');
    expect(getAgentModel('finance')).toBe('gemini-3-flash-preview');
    expect(getAgentModel('imagegen')).toBe('gpt-image-1.5');
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

describe('getAllAgentConfigs', () => {
  it('should return all 8 configurations', () => {
    const configs = getAllAgentConfigs();
    expect(configs).toHaveLength(8);
  });

  it('should return array of AgentConfig objects', () => {
    const configs = getAllAgentConfigs();
    configs.forEach((config) => {
      expect(config.name).toBeDefined();
      expect(config.type).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.instructions).toBeDefined();
      expect(config.tools).toBeDefined();
    });
  });
});

describe('getAgentByName', () => {
  it('should find agent by exact name', () => {
    const config = getAgentByName('DevBot');
    expect(config).toBeDefined();
    expect(config?.type).toBe('coder');
  });

  it('should find agent by name case-insensitively', () => {
    expect(getAgentByName('devbot')?.type).toBe('coder');
    expect(getAgentByName('DEVBOT')?.type).toBe('coder');
    expect(getAgentByName('DevBot')?.type).toBe('coder');
  });

  it('should return undefined for unknown name', () => {
    expect(getAgentByName('UnknownBot')).toBeUndefined();
  });

  it('should find Q8 orchestrator', () => {
    const config = getAgentByName('Q8');
    expect(config).toBeDefined();
    expect(config?.type).toBe('orchestrator');
  });
});

// =============================================================================
// Tool Assignment Validation Tests
// =============================================================================

describe('tool assignments', () => {
  it('coder should have all github tools', () => {
    const coderTools = getAgentTools('coder');
    githubTools.forEach((githubTool) => {
      expect(coderTools.some((t) => t.name === githubTool.name)).toBe(true);
    });
  });

  it('personality should have all spotify tools', () => {
    const personalityTools = getAgentTools('personality');
    spotifyTools.forEach((spotifyTool) => {
      expect(personalityTools.some((t) => t.name === spotifyTool.name)).toBe(true);
    });
  });

  it('all agents except imagegen should have default tools', () => {
    const agentsWithDefaults: AgentType[] = [
      'orchestrator',
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
    ];

    agentsWithDefaults.forEach((agentType) => {
      const tools = getAgentTools(agentType);
      defaultTools.forEach((defaultTool) => {
        expect(tools.some((t) => t.name === defaultTool.name)).toBe(true);
      });
    });
  });

  it('only orchestrator should have handoffs', () => {
    const agents = getAllAgentConfigs();
    agents.forEach((config) => {
      if (config.type === 'orchestrator') {
        expect(config.handoffs).toBeDefined();
        expect(config.handoffs?.length).toBeGreaterThan(0);
      } else {
        expect(config.handoffs).toBeUndefined();
      }
    });
  });
});

// =============================================================================
// Model Options Validation Tests
// =============================================================================

describe('model options', () => {
  it('coder should have extendedThinking enabled', () => {
    const config = getAgentConfig('coder');
    expect(config.modelOptions?.extendedThinking).toBe(true);
  });

  it('creative agents should have higher temperature', () => {
    const personality = getAgentConfig('personality');
    const imagegen = getAgentConfig('imagegen');

    expect(personality.modelOptions?.temperature).toBeGreaterThan(0.7);
    expect(imagegen.modelOptions?.temperature).toBeGreaterThan(0.7);
  });

  it('precision agents should have lower temperature', () => {
    const coder = getAgentConfig('coder');
    const home = getAgentConfig('home');
    const finance = getAgentConfig('finance');

    expect(coder.modelOptions?.temperature).toBeLessThanOrEqual(0.5);
    expect(home.modelOptions?.temperature).toBeLessThanOrEqual(0.5);
    expect(finance.modelOptions?.temperature).toBeLessThanOrEqual(0.5);
  });
});
