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
} from './types';

// Parser
export {
  detectFileType,
  parseDocument,
  estimateTokens,
} from './parser';

// Processor
export {
  uploadDocument,
  processDocument,
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
