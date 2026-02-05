/**
 * Centralized validation schemas for API routes
 *
 * Usage:
 * ```typescript
 * import { chatMessageSchema, type ChatMessageInput } from '@/lib/validations';
 *
 * const result = chatMessageSchema.safeParse(body);
 * if (!result.success) {
 *   return NextResponse.json({
 *     error: 'Validation failed',
 *     details: result.error.flatten(),
 *   }, { status: 400 });
 * }
 * const data = result.data;
 * ```
 */

export * from './finance';
export * from './notes';
export * from './chat';
export * from './spotify';
export * from './memories';
export * from './voice';
export * from './contenthub';
export * from './tasks';
export * from './threads';
export * from './tools';

/**
 * Helper function to create validation error response
 * Re-exports the shared helper from @/lib/api/error-responses for backward compatibility
 */
export { validationErrorResponse } from '@/lib/api/error-responses';

// Keep unused imports removed to satisfy linter
