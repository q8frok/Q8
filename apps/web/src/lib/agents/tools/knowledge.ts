/**
 * Knowledge Base Tools
 * Tools for agents to explicitly query the user's document knowledge base
 */

import { searchDocuments, getConversationContext } from '@/lib/documents/processor';
import type { DocumentChunk, FileType } from '@/lib/documents/types';
import { logger } from '@/lib/logger';
import type { OpenAITool } from '../types';

/**
 * OpenAI tool definitions for knowledge base operations
 */
export const knowledgeTools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the user\'s uploaded documents and knowledge base for relevant information. Use this when the user asks about documents they\'ve shared, or when you need specific information from their files.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant document content',
          },
          fileTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx'],
            },
            description: 'Optional: Filter by specific file types',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: 'List the user\'s uploaded documents. Use this to see what files the user has in their knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['global', 'conversation'],
            description: 'Filter by document scope',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * Execute a knowledge tool
 */
export async function executeKnowledgeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  threadId?: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    switch (toolName) {
      case 'search_knowledge': {
        const query = args.query as string;
        const fileTypes = args.fileTypes as string[] | undefined;
        const limit = (args.limit as number) || 5;

        const results = await searchDocuments(userId, query, {
          limit,
          minSimilarity: 0.6,
          fileTypes: fileTypes as FileType[],
        });

        if (results.length === 0) {
          return {
            success: true,
            message: 'No relevant documents found for the query.',
            data: { results: [], count: 0 },
          };
        }

        // Format results for the agent
        const formattedResults = results.map((chunk, i) => ({
          rank: i + 1,
          document: chunk.metadata?.documentName || 'Unknown',
          content: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? '...' : ''),
          similarity: chunk.metadata?.similarity || 0,
          page: chunk.sourcePage,
        }));

        return {
          success: true,
          message: `Found ${results.length} relevant document sections.`,
          data: { results: formattedResults, count: results.length },
        };
      }

      case 'list_documents': {
        const { getUserDocuments } = await import('@/lib/documents/processor');
        const scope = args.scope as 'global' | 'conversation' | undefined;

        const { documents, total } = await getUserDocuments(userId, {
          scope,
          threadId,
          status: 'ready',
          limit: 20,
        });

        const formattedDocs = documents.map((doc) => ({
          name: doc.name,
          type: doc.fileType,
          chunks: doc.chunkCount,
          uploadedAt: doc.createdAt,
        }));

        return {
          success: true,
          message: `Found ${total} documents in the knowledge base.`,
          data: { documents: formattedDocs, total },
        };
      }

      default:
        return {
          success: false,
          message: `Unknown knowledge tool: ${toolName}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Knowledge tool execution failed', { toolName, error });

    return {
      success: false,
      message: `Failed to execute ${toolName}: ${errorMessage}`,
    };
  }
}

/**
 * Get knowledge context for a query (for injection into prompts)
 */
export async function getKnowledgeContext(
  userId: string,
  threadId: string,
  query: string,
  maxTokens: number = 4000
): Promise<string> {
  try {
    const { content, sources } = await getConversationContext(
      userId,
      threadId,
      query,
      maxTokens
    );

    if (!content || sources.length === 0) {
      return '';
    }

    return content;
  } catch (error) {
    logger.warn('Failed to get knowledge context', { userId, threadId, error });
    return '';
  }
}
