/**
 * Documents Module
 * File upload and knowledge base functionality
 */

// Types
export type {
  FileType,
  DocumentStatus,
  DocumentScope,
  ChunkType,
  Document,
  DocumentChunk,
  DocumentWithChunks,
  DocumentSearchResult,
  ConversationContext,
  UploadDocumentRequest,
  ParsedDocument,
  ParsedChunk,
  DocumentFolder,
  FolderTreeNode,
  FolderContents,
  CreateFolderRequest,
  RenameFolderRequest,
  MoveDocumentRequest,
  DocumentTag,
  DocumentVersion,
  BulkActionRequest,
} from './types';

// Parser
export {
  detectFileType,
  parseDocument,
  estimateTokens,
} from './parser';

// Validation
export {
  validateMagicBytes,
  getValidationErrorMessage,
} from './validation';

// Processor
export {
  uploadDocument,
  processDocument,
  reprocessDocument,
  searchDocuments,
  getConversationContext,
  deleteDocument,
  getUserDocuments,
  getDocumentWithChunks,
  createFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
  getFolderTree,
  getFolderContents,
  getFolderBreadcrumb,
  moveDocument,
} from './processor';

// Worker
export { processDocumentJob } from './worker';
