/**
 * Document Types
 * Type definitions for the document/knowledge base system
 */

export type FileType =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'txt'
  | 'md'
  | 'csv'
  | 'json'
  | 'xlsx'
  | 'xls'
  | 'code'
  | 'pptx'
  | 'ppt'
  | 'image'
  | 'other';

export type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'error'
  | 'archived';

export type DocumentScope = 'conversation' | 'global';

export type ChunkType = 'text' | 'code' | 'table' | 'heading' | 'metadata';

/**
 * Document metadata stored in the database
 */
export interface Document {
  id: string;
  userId: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageBucket: string;
  fileType: FileType;
  status: DocumentStatus;
  processingError?: string;
  scope: DocumentScope;
  threadId?: string;
  folderId?: string | null;
  metadata: Record<string, unknown>;
  chunkCount: number;
  tokenCount: number;
  contentHash?: string;
  tags?: DocumentTag[];
  version: number;
  parentDocumentId?: string | null;
  isLatest: boolean;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

/**
 * Document chunk with embedding
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  chunkType: ChunkType;
  sourcePage?: number;
  sourceLineStart?: number;
  sourceLineEnd?: number;
  embedding?: number[];
  tokenCount?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Upload request
 */
export interface UploadDocumentRequest {
  file: File;
  scope: DocumentScope;
  threadId?: string;
  name?: string;
}

/**
 * Document with chunks for display
 */
export interface DocumentWithChunks extends Document {
  chunks: DocumentChunk[];
}

/**
 * Search result
 */
export interface DocumentSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  fileType: FileType;
  content: string;
  chunkType: ChunkType;
  sourcePage?: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Conversation context from documents
 */
export interface ConversationContext {
  chunkId: string;
  documentName: string;
  content: string;
  similarity: number;
  cumulativeTokens: number;
}

/**
 * File type detection result
 */
export interface FileTypeInfo {
  fileType: FileType;
  mimeType: string;
  extension: string;
}

/**
 * Parsing result from a document
 */
export interface ParsedDocument {
  content: string;
  metadata: Record<string, unknown>;
  chunks: ParsedChunk[];
}

/**
 * A chunk from parsing
 */
export interface ParsedChunk {
  content: string;
  chunkType: ChunkType;
  sourcePage?: number;
  sourceLineStart?: number;
  sourceLineEnd?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Document folder
 */
export interface DocumentFolder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  color: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Folder tree node with children
 */
export interface FolderTreeNode extends DocumentFolder {
  children: FolderTreeNode[];
  depth: number;
  path: string[];
}

/**
 * Folder contents response
 */
export interface FolderContents {
  folder: DocumentFolder | null;
  breadcrumb: Array<{ id: string; name: string; parentId: string | null }>;
  subfolders: DocumentFolder[];
  documents: Document[];
  totalDocuments: number;
}

/**
 * Create folder request
 */
export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
  color?: string | null;
}

/**
 * Rename folder request
 */
export interface RenameFolderRequest {
  name: string;
}

/**
 * Move document request
 */
export interface MoveDocumentRequest {
  folderId: string | null;
}

/**
 * Document tag
 */
export interface DocumentTag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

/**
 * Document version summary (for version history list)
 */
export interface DocumentVersion {
  id: string;
  name: string;
  version: number;
  isLatest: boolean;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
}

/**
 * Bulk action request
 */
export interface BulkActionRequest {
  action: 'delete' | 'move' | 'tag';
  documentIds: string[];
  params?: {
    folderId?: string | null;
    tagId?: string;
  };
}
