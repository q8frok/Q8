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
              enum: ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'json', 'xlsx', 'xls', 'code', 'pptx', 'ppt', 'image'],
            },
            description: 'Optional: Filter by specific file types',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
          folderId: {
            type: 'string',
            description: 'Optional: Filter search to a specific folder ID',
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
          folderId: {
            type: 'string',
            description: 'Optional: Filter to documents in a specific folder',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_folders',
      description: 'Browse the folder structure in the knowledge base. Returns the folder tree or contents of a specific folder with document counts.',
      parameters: {
        type: 'object',
        properties: {
          folderId: {
            type: 'string',
            description: 'Optional: Get contents of a specific folder. Omit to get the full folder tree.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_document_content',
      description: 'Get the full content of a specific document by name. Use this when you need to read or reference the entire contents of a document the user has uploaded.',
      parameters: {
        type: 'object',
        properties: {
          documentName: {
            type: 'string',
            description: 'The name (or partial name) of the document to retrieve',
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to return (default: 8000)',
          },
        },
        required: ['documentName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_document',
      description: 'Get the first portion of a document\'s content for summarization. Returns the beginning chunks of the document so you can generate a summary.',
      parameters: {
        type: 'object',
        properties: {
          documentName: {
            type: 'string',
            description: 'The name (or partial name) of the document to summarize',
          },
          maxChunks: {
            type: 'number',
            description: 'Maximum number of chunks to return (default: 10)',
          },
        },
        required: ['documentName'],
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
        const searchFolderId = args.folderId as string | undefined;

        const results = await searchDocuments(userId, query, {
          limit,
          minSimilarity: 0.6,
          fileTypes: fileTypes as FileType[],
          folderId: searchFolderId,
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
        const listFolderId = args.folderId as string | undefined;

        const { documents, total } = await getUserDocuments(userId, {
          scope,
          threadId,
          status: 'ready',
          limit: 20,
          folderId: listFolderId,
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

      case 'get_document_content': {
        const { getUserDocuments, getDocumentWithChunks } = await import('@/lib/documents/processor');
        const documentName = args.documentName as string;
        const maxTokens = (args.maxTokens as number) || 8000;

        // Find the document by name
        const { documents } = await getUserDocuments(userId, {
          status: 'ready',
          limit: 50,
        });

        const matchingDoc = documents.find((doc) =>
          doc.name.toLowerCase().includes(documentName.toLowerCase()) ||
          doc.originalName.toLowerCase().includes(documentName.toLowerCase())
        );

        if (!matchingDoc) {
          return {
            success: false,
            message: `No document found matching "${documentName}". Use list_documents to see available files.`,
          };
        }

        const docWithChunks = await getDocumentWithChunks(matchingDoc.id, userId);
        let content = '';
        let tokenCount = 0;

        for (const chunk of docWithChunks.chunks) {
          const chunkTokens = chunk.tokenCount || Math.ceil(chunk.content.length / 4);
          if (tokenCount + chunkTokens > maxTokens) break;
          content += chunk.content + '\n\n';
          tokenCount += chunkTokens;
        }

        return {
          success: true,
          message: `Retrieved content from "${matchingDoc.name}" (${tokenCount} tokens, ${docWithChunks.chunks.length} total chunks).`,
          data: {
            documentName: matchingDoc.name,
            fileType: matchingDoc.fileType,
            content: content.trim(),
            totalChunks: docWithChunks.chunks.length,
            tokensReturned: tokenCount,
            truncated: tokenCount >= maxTokens,
          },
        };
      }

      case 'summarize_document': {
        const { getUserDocuments, getDocumentWithChunks } = await import('@/lib/documents/processor');
        const docName = args.documentName as string;
        const maxChunks = (args.maxChunks as number) || 10;

        const { documents } = await getUserDocuments(userId, {
          status: 'ready',
          limit: 50,
        });

        const matchDoc = documents.find((doc) =>
          doc.name.toLowerCase().includes(docName.toLowerCase()) ||
          doc.originalName.toLowerCase().includes(docName.toLowerCase())
        );

        if (!matchDoc) {
          return {
            success: false,
            message: `No document found matching "${docName}". Use list_documents to see available files.`,
          };
        }

        const docData = await getDocumentWithChunks(matchDoc.id, userId);
        const selectedChunks = docData.chunks.slice(0, maxChunks);
        const content = selectedChunks.map((c) => c.content).join('\n\n');

        return {
          success: true,
          message: `Here are the first ${selectedChunks.length} chunks from "${matchDoc.name}". Please summarize this content for the user.`,
          data: {
            documentName: matchDoc.name,
            fileType: matchDoc.fileType,
            content,
            chunksReturned: selectedChunks.length,
            totalChunks: docData.chunks.length,
          },
        };
      }

      case 'browse_folders': {
        const browseFolderId = args.folderId as string | undefined;

        if (browseFolderId) {
          const { getFolderContents } = await import('@/lib/documents/processor');
          const contents = await getFolderContents(userId, browseFolderId);

          return {
            success: true,
            message: `Folder "${contents.folder?.name || 'Root'}" contains ${contents.subfolders.length} subfolders and ${contents.totalDocuments} documents.`,
            data: {
              folder: contents.folder ? { id: contents.folder.id, name: contents.folder.name } : null,
              breadcrumb: contents.breadcrumb.map((b) => b.name),
              subfolders: contents.subfolders.map((f) => ({
                id: f.id,
                name: f.name,
                documentCount: f.documentCount,
              })),
              documentCount: contents.totalDocuments,
              documents: contents.documents.slice(0, 10).map((d) => ({
                name: d.name,
                type: d.fileType,
              })),
            },
          };
        }

        const { getFolderTree } = await import('@/lib/documents/processor');
        const tree = await getFolderTree(userId);

        const flattenTree = (nodes: Array<{ id: string; name: string; documentCount: number; children: unknown[] }>, depth = 0): Array<{ id: string; name: string; depth: number; documentCount: number }> => {
          const result: Array<{ id: string; name: string; depth: number; documentCount: number }> = [];
          for (const node of nodes) {
            result.push({ id: node.id, name: node.name, depth, documentCount: node.documentCount });
            result.push(...flattenTree(node.children as typeof nodes, depth + 1));
          }
          return result;
        };

        const flatTree = flattenTree(tree);

        return {
          success: true,
          message: `Knowledge base has ${flatTree.length} folders.`,
          data: {
            folders: flatTree.map((f) => ({
              id: f.id,
              name: '  '.repeat(f.depth) + f.name,
              documentCount: f.documentCount,
            })),
            totalFolders: flatTree.length,
          },
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
