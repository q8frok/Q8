/**
 * ContentHub API validation schemas
 */
import { z } from 'zod';

// Aligned with ContentSource type in @/types/contenthub
export const contentSourceEnum = z.enum([
  'spotify',
  'youtube',
  'netflix',
  'primevideo',
  'disney',
  'instagram',
  'facebook',
  'podcast',
]);

export const contentModeEnum = z.enum([
  'discover',
  'focus',
  'break',
  'workout',
  'sleep',
]);

// Aligned with ContentType type in @/types/contenthub
export const contentTypeEnum = z.enum([
  'track',
  'video',
  'movie',
  'tvshow',
  'reel',
  'podcast_episode',
]);

export const contentActionEnum = z.enum(['play', 'queue', 'save']);

// Aligned with ContentItem interface in @/types/contenthub
export const contentItemSchema = z.object({
  id: z.string(),
  source: contentSourceEnum,
  type: contentTypeEnum,
  title: z.string(),
  subtitle: z.string(),
  thumbnailUrl: z.string(),
  duration: z.number(),
  playbackUrl: z.string().optional(),
  deepLinkUrl: z.string().optional(),
  sourceMetadata: z.record(z.unknown()),
});

export const contentHubActionSchema = z.object({
  action: contentActionEnum,
  item: contentItemSchema,
});

export const contentHubSearchSchema = z.object({
  query: z.string().min(1).max(200),
  sources: z.array(contentSourceEnum).optional(),
  type: contentTypeEnum.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const castSchema = z.object({
  itemId: z.string(),
  deviceId: z.string(),
  source: contentSourceEnum,
});

export const aiRecommendSchema = z.object({
  mood: z.string().max(100).optional(),
  activity: z.string().max(100).optional(),
  sources: z.array(contentSourceEnum).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export type ContentHubActionInput = z.infer<typeof contentHubActionSchema>;
export type ContentHubSearchInput = z.infer<typeof contentHubSearchSchema>;
export type CastInput = z.infer<typeof castSchema>;
export type AIRecommendInput = z.infer<typeof aiRecommendSchema>;
