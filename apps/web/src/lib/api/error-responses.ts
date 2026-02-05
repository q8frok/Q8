import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function errorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse<{ error: ApiError }> {
  const errorCode = code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  return NextResponse.json({ error: { code: errorCode, message } }, { status });
}

export function unauthorizedResponse(): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  );
}

export function notFoundResponse(resource: string): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
    { status: 404 }
  );
}

export function rateLimitedResponse(): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429 }
  );
}

export function validationErrorResponse(
  zodError: ZodError | { flatten: () => unknown }
): NextResponse<{ error: ApiError }> {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: zodError.flatten(),
      },
    },
    { status: 400 }
  );
}
