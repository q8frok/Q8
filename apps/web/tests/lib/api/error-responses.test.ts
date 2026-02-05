import { describe, it, expect } from 'vitest';
import {
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  rateLimitedResponse,
} from '@/lib/api/error-responses';

describe('API Error Responses', () => {
  it('returns consistent error format with code and message', async () => {
    const res = errorResponse('Something failed', 500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something failed' },
    });
    expect(res.status).toBe(500);
  });

  it('returns 401 for unauthorized', async () => {
    const res = unauthorizedResponse();
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(res.status).toBe(401);
  });

  it('returns 404 for not found', async () => {
    const res = notFoundResponse('Task');
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Task');
    expect(res.status).toBe(404);
  });

  it('returns 429 for rate limited', async () => {
    const res = rateLimitedResponse();
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(res.status).toBe(429);
  });

  it('returns 400 for validation errors with details', async () => {
    const mockZodError = {
      flatten: () => ({
        fieldErrors: { message: ['Required'] },
      }),
    };
    const res = validationErrorResponse(mockZodError as never);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(res.status).toBe(400);
  });

  it('uses custom error code when provided', async () => {
    const res = errorResponse('Bad input', 400, 'INVALID_FORMAT');
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_FORMAT');
  });
});
