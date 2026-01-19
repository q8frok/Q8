/**
 * Voice API validation schemas
 */
import { z } from 'zod';

export const voiceTypeEnum = z.enum([
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
]);

export const synthesizeSchema = z.object({
  text: z.string().min(1, 'Text is required').max(4096, 'Text too long (max 4096 chars)'),
  voice: voiceTypeEnum.default('nova'),
  speed: z.number().min(0.25).max(4.0).default(1.0),
});

// Note: transcribe uses FormData, validated separately
export const transcribeLanguageSchema = z.object({
  language: z.string().length(2).default('en'),
});

export type SynthesizeInput = z.infer<typeof synthesizeSchema>;
export type TranscribeLanguageInput = z.infer<typeof transcribeLanguageSchema>;
