import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkToolAvailability, checkAllAgentsAvailability, type AgentType } from '@/lib/agents/sdk/utils/preflight';

describe('checkToolAvailability', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns available=true when all credentials present for personality', () => {
    process.env.SPOTIFY_REFRESH_TOKEN = 'test-token';
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const result = checkToolAvailability('personality');
    expect(result.available).toBe(true);
    expect(result.missingCredentials).toHaveLength(0);
  });

  it('returns available=false with missing credentials', () => {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const result = checkToolAvailability('personality');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('Spotify');
  });

  it('checks github credentials for coder agent', () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_test';

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(true);
  });

  it('returns available=false when github token missing for coder', () => {
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('GitHub');
  });

  it('checks home assistant credentials', () => {
    process.env.HASS_TOKEN = 'test-token';
    process.env.HASS_URL = 'http://homeassistant.local';

    const result = checkToolAvailability('home');
    expect(result.available).toBe(true);
  });

  it('returns available=false when home assistant token missing', () => {
    delete process.env.HASS_TOKEN;
    delete process.env.HASS_URL;

    const result = checkToolAvailability('home');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('Home Assistant');
  });

  it('treats placeholder values as missing', () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'placeholder';

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('GitHub');
  });

  it('treats empty strings as missing', () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = '';

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('GitHub');
  });

  it('treats whitespace-only values as missing', () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = '   ';

    const result = checkToolAvailability('coder');
    expect(result.available).toBe(false);
    expect(result.missingCredentials).toContain('GitHub');
  });

  it('checks orchestrator credentials', () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const result = checkToolAvailability('orchestrator');
    expect(result.available).toBe(true);
  });

  it('checks researcher credentials', () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-test';

    const result = checkToolAvailability('researcher');
    expect(result.available).toBe(true);
  });

  it('checks secretary credentials', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.YOUTUBE_API_KEY = 'test-key';

    const result = checkToolAvailability('secretary');
    expect(result.available).toBe(true);
  });

  it('checks finance credentials', () => {
    process.env.PLAID_CLIENT_ID = 'test-id';
    process.env.PLAID_SECRET = 'test-secret';

    const result = checkToolAvailability('finance');
    expect(result.available).toBe(true);
  });

  it('checks imagegen credentials', () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const result = checkToolAvailability('imagegen');
    expect(result.available).toBe(true);
  });
});

describe('checkAllAgentsAvailability', () => {
  it('returns availability for all agent types', () => {
    const result = checkAllAgentsAvailability();

    expect(result).toHaveProperty('orchestrator');
    expect(result).toHaveProperty('coder');
    expect(result).toHaveProperty('researcher');
    expect(result).toHaveProperty('secretary');
    expect(result).toHaveProperty('personality');
    expect(result).toHaveProperty('home');
    expect(result).toHaveProperty('finance');
    expect(result).toHaveProperty('imagegen');
  });

  it('returns proper structure for each agent', () => {
    const result = checkAllAgentsAvailability();

    for (const agentResult of Object.values(result)) {
      expect(agentResult).toHaveProperty('available');
      expect(agentResult).toHaveProperty('missingCredentials');
      expect(agentResult).toHaveProperty('degradedTools');
      expect(typeof agentResult.available).toBe('boolean');
      expect(Array.isArray(agentResult.missingCredentials)).toBe(true);
      expect(Array.isArray(agentResult.degradedTools)).toBe(true);
    }
  });
});

describe('getAvailabilityReport', () => {
  it('returns a formatted string report', async () => {
    const { getAvailabilityReport } = await import('@/lib/agents/sdk/utils/preflight');
    const report = getAvailabilityReport();

    expect(typeof report).toBe('string');
    expect(report).toContain('Agent Tool Availability');
  });
});
