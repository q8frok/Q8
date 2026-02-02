/**
 * Memory API Route
 * Store, retrieve, and search memories
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  storeLongTermMemory,
  searchMemories,
  getRelevantMemories,
  deleteMemory,
  getUserPreferences,
  updateUserPreferences,
  buildMemoryContext,
  type MemoryType,
  type MemoryImportance,
} from '@/lib/memory';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

interface StoreRequest {
  action: 'store';
  content: string;
  type: MemoryType;
  importance?: MemoryImportance;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchRequest {
  action: 'search';
  query?: string;
  types?: MemoryType[];
  tags?: string[];
  minImportance?: MemoryImportance;
  limit?: number;
}

interface DeleteRequest {
  action: 'delete';
  memoryId: string;
}

interface GetContextRequest {
  action: 'getContext';
  sessionId: string;
}

interface GetPreferencesRequest {
  action: 'getPreferences';
}

interface UpdatePreferencesRequest {
  action: 'updatePreferences';
  preferences: Record<string, unknown>;
}

type MemoryRequest =
  | StoreRequest
  | SearchRequest
  | DeleteRequest
  | GetContextRequest
  | GetPreferencesRequest
  | UpdatePreferencesRequest;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as MemoryRequest;

    switch (body.action) {
      case 'store': {
        const memory = storeLongTermMemory(
          user.id,
          body.content,
          body.type,
          {
            importance: body.importance,
            tags: body.tags,
            metadata: body.metadata,
          }
        );
        return NextResponse.json({ success: true, memory });
      }

      case 'search': {
        const results = searchMemories({
          userId: user.id,
          query: body.query,
          types: body.types,
          tags: body.tags,
          minImportance: body.minImportance,
          limit: body.limit || 10,
        });
        return NextResponse.json({ success: true, results });
      }

      case 'delete': {
        const deleted = deleteMemory(user.id, body.memoryId);
        return NextResponse.json({ success: deleted });
      }

      case 'getContext': {
        const context = buildMemoryContext(user.id, body.sessionId);
        return NextResponse.json({ success: true, context });
      }

      case 'getPreferences': {
        const preferences = getUserPreferences(user.id);
        return NextResponse.json({ success: true, preferences });
      }

      case 'updatePreferences': {
        const updated = updateUserPreferences(user.id, body.preferences);
        return NextResponse.json({ success: true, preferences: updated });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[Memory API] Error', { error: error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
