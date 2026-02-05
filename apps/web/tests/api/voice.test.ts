/**
 * Voice API Route Tests
 *
 * Tests for /api/voice/transcribe covering:
 * - Audio transcription via OpenAI Whisper
 * - Authentication
 * - Error handling
 * - FormData processing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mock functions
const { mockGetAuthenticatedUser, mockFetch } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockFetch: vi.fn(),
}));

// Mock auth module
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  },
}));

// Mock error responses
vi.mock('@/lib/api/error-responses', () => ({
  errorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'ERROR', message } },
      { status }
    );
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { POST } from '@/app/api/voice/transcribe/route';

describe('POST /api/voice/transcribe', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    // Save and mock fetch
    originalFetch = global.fetch;
    global.fetch = mockFetch;

    // Save and set env
    originalEnv = process.env;
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  function createAudioFormData(audioBlob?: Blob, language?: string): FormData {
    const formData = new FormData();
    if (audioBlob) {
      formData.append('audio', audioBlob, 'audio.webm');
    }
    if (language) {
      formData.append('language', language);
    }
    return formData;
  }

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const formData = createAudioFormData(new Blob(['audio-data'], { type: 'audio/webm' }));
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when no audio file is provided', async () => {
    const formData = createAudioFormData(); // No audio
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.message).toContain('audio');
  });

  it('returns 500 when OpenAI API key is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob);
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.message).toContain('API key');
  });

  it('transcribes audio successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello, this is a transcription test.' }),
    });

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob, 'en');
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.text).toBe('Hello, this is a transcription test.');
    expect(body.language).toBe('en');
  });

  it('calls OpenAI Whisper API with correct parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Test transcription' }),
    });

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob, 'es');
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    await POST(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
        },
      })
    );

    // Verify FormData was passed
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].body).toBeInstanceOf(FormData);
  });

  it('defaults to English when no language is specified', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Test' }),
    });

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob); // No language
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.language).toBe('en');
  });

  it('handles OpenAI API errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob);
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error.message).toContain('429');
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' });
    const formData = createAudioFormData(audioBlob);
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.message).toContain('Network error');
  });

  it('handles different audio formats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Audio content' }),
    });

    // Test with WAV format
    const wavBlob = new Blob(['wav-data'], { type: 'audio/wav' });
    const formData = createAudioFormData(wavBlob);
    const request = new NextRequest('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
