/**
 * Vitest Test Setup
 * Global configuration for all tests
 */

import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
vi.stubEnv('PERPLEXITY_API_KEY', 'test-perplexity-key');
vi.stubEnv('GOOGLE_GENERATIVE_AI_KEY', 'test-google-key');
vi.stubEnv('XAI_API_KEY', 'test-xai-key');

// Mock fetch globally
global.fetch = vi.fn();

// Mock ResizeObserver (needed for some components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
