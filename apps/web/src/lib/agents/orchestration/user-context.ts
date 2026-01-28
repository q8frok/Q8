/**
 * User Context Service (The Memex)
 * Provides unified context about the user that all agents can read and write
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export type ContextType =
  | 'preference'      // User preferences (communication style, UI, etc.)
  | 'habit'           // Learned behavior patterns
  | 'schedule'        // Work hours, typical routines
  | 'bio_rhythm'      // Sleep/wake patterns, energy levels
  | 'relationship'    // People and their relationships
  | 'goal'            // User goals and objectives
  | 'fact';           // Personal facts (birthday, location, etc.)

export interface UserContext {
  id: string;
  userId: string;
  contextType: ContextType;
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  sourceAgent?: string;
  sourceThreadId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserContextSummary {
  preferences: Record<string, unknown>;
  habits: Record<string, unknown>;
  schedule: Record<string, unknown>;
  bioRhythm: Record<string, unknown>;
  relationships: Record<string, unknown>;
  goals: Record<string, unknown>;
  facts: Record<string, unknown>;
}

/**
 * Fetch all user context for agent prompt injection
 */
export async function getUserContext(userId: string): Promise<UserContextSummary> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_context')
      .select('context_type, key, value, confidence')
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()')
      .gte('confidence', 0.5)
      .order('confidence', { ascending: false });

    if (error) {
      logger.warn('Failed to fetch user context', { userId, error });
      return getEmptyContext();
    }

    // Group by context type
    const grouped: UserContextSummary = getEmptyContext();

    for (const item of data || []) {
      const typeMap: Record<string, keyof UserContextSummary> = {
        preference: 'preferences',
        habit: 'habits',
        schedule: 'schedule',
        bio_rhythm: 'bioRhythm',
        relationship: 'relationships',
        goal: 'goals',
        fact: 'facts',
      };

      const target = typeMap[item.context_type];
      if (target && grouped[target]) {
        grouped[target][item.key] = item.value;
      }
    }

    return grouped;
  } catch (error) {
    logger.error('Error fetching user context', { userId, error });
    return getEmptyContext();
  }
}

/**
 * Get empty context structure
 */
function getEmptyContext(): UserContextSummary {
  return {
    preferences: {},
    habits: {},
    schedule: {},
    bioRhythm: {},
    relationships: {},
    goals: {},
    facts: {},
  };
}

/**
 * Update or insert user context (for agents to write back learnings)
 */
export async function updateUserContext(
  userId: string,
  contextType: ContextType,
  key: string,
  value: Record<string, unknown>,
  options?: {
    confidence?: number;
    sourceAgent?: string;
    sourceThreadId?: string;
    expiresAt?: Date;
  }
): Promise<UserContext | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_context')
      .upsert(
        {
          user_id: userId,
          context_type: contextType,
          key,
          value,
          confidence: options?.confidence ?? 1.0,
          source_agent: options?.sourceAgent,
          source_thread_id: options?.sourceThreadId,
          expires_at: options?.expiresAt?.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,context_type,key',
        }
      )
      .select()
      .single();

    if (error) {
      logger.error('Failed to update user context', { userId, contextType, key, error });
      return null;
    }

    logger.debug('User context updated', { userId, contextType, key });
    return data as UserContext;
  } catch (error) {
    logger.error('Error updating user context', { userId, contextType, key, error });
    return null;
  }
}

/**
 * Delete a specific user context entry
 */
export async function deleteUserContext(
  userId: string,
  contextType: ContextType,
  key: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('user_context')
      .delete()
      .eq('user_id', userId)
      .eq('context_type', contextType)
      .eq('key', key);

    if (error) {
      logger.error('Failed to delete user context', { userId, contextType, key, error });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error deleting user context', { userId, contextType, key, error });
    return false;
  }
}

/**
 * Build a prompt-friendly context summary for injection into system prompts
 */
export function buildUserContextPrompt(context: UserContextSummary): string {
  const sections: string[] = [];

  sections.push('## User Context (Personalization)');
  sections.push('');

  // Preferences
  if (Object.keys(context.preferences).length > 0) {
    sections.push('### Preferences');
    for (const [key, value] of Object.entries(context.preferences)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Facts
  if (Object.keys(context.facts).length > 0) {
    sections.push('### Personal Information');
    for (const [key, value] of Object.entries(context.facts)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Schedule
  if (Object.keys(context.schedule).length > 0) {
    sections.push('### Schedule');
    for (const [key, value] of Object.entries(context.schedule)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Bio-Rhythm
  if (Object.keys(context.bioRhythm).length > 0) {
    sections.push('### Bio-Rhythm');
    for (const [key, value] of Object.entries(context.bioRhythm)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Goals
  if (Object.keys(context.goals).length > 0) {
    sections.push('### Goals');
    for (const [key, value] of Object.entries(context.goals)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Relationships
  if (Object.keys(context.relationships).length > 0) {
    sections.push('### Known Relationships');
    for (const [key, value] of Object.entries(context.relationships)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Habits
  if (Object.keys(context.habits).length > 0) {
    sections.push('### Observed Habits');
    for (const [key, value] of Object.entries(context.habits)) {
      sections.push(`- **${formatKey(key)}**: ${formatValue(value)}`);
    }
    sections.push('');
  }

  // Return empty string if no context
  if (sections.length <= 2) {
    return '';
  }

  return sections.join('\n');
}

/**
 * Format a key for display (snake_case to Title Case)
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    // Check if it has a 'value' or 'description' field
    if ('description' in obj) return String(obj.description);
    if ('value' in obj) return String(obj.value);
    // Otherwise, return key-value pairs
    const pairs = Object.entries(obj)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${formatKey(k)}: ${v}`)
      .join(', ');
    return pairs || JSON.stringify(value);
  }
  return String(value);
}

/**
 * Extract and save context from a conversation
 * This is called after memory extraction to also update user context
 */
export async function extractUserContext(
  userId: string,
  threadId: string,
  memories: Array<{
    content: string;
    memory_type: string;
    tags?: string[];
  }>,
  sourceAgent?: string
): Promise<void> {
  // Map memory types to context types
  const typeMapping: Record<string, ContextType> = {
    preference: 'preference',
    fact: 'fact',
    relationship: 'relationship',
    task: 'goal',
    event: 'schedule',
  };

  for (const memory of memories) {
    const contextType = typeMapping[memory.memory_type];
    if (!contextType) continue;

    // Generate a key from the content (first few words or a hash)
    const key = generateContextKey(memory.content);

    await updateUserContext(userId, contextType, key, {
      description: memory.content,
      tags: memory.tags || [],
      extractedAt: new Date().toISOString(),
    }, {
      confidence: 0.8, // Extracted context starts with 0.8 confidence
      sourceAgent,
      sourceThreadId: threadId,
    });
  }
}

/**
 * Generate a context key from content
 */
function generateContextKey(content: string): string {
  // Take first 50 chars, remove special chars, convert to snake_case
  return content
    .slice(0, 50)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
