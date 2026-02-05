/**
 * Document Processor
 * Handles the full pipeline: upload → parse → chunk → embed → store
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { generateEmbeddingsBatch } from '@/lib/embeddings';
import { parseDocument, detectFileType, estimateTokens } from './parser';
import type {
  Document,
  DocumentChunk,
  DocumentFolder,
  FolderTreeNode,
  FolderContents,
  FileType,
  DocumentScope,
} from './types';
import { validateMagicBytes, getValidationErrorMessage } from './validation';
import { logger } from '@/lib/logger';

const STORAGE_BUCKET = 'documents';

/**
 * Upload and process a document
 */
export async function uploadDocument(
  file: File,
  userId: string,
  options: {
    scope: DocumentScope;
    threadId?: string;
    name?: string;
    folderId?: string | null;
  }
): Promise<Document> {
  const { scope, threadId, name, folderId } = options;

  // Compute content hash for dedup
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('documents')
    .select('id, name')
    .eq('user_id', userId)
    .eq('content_hash', contentHash)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const error = new Error('Duplicate file') as Error & { status: number; existingDocument: { id: string; name: string } };
    error.status = 409;
    error.existingDocument = { id: existing.id, name: existing.name };
    throw error;
  }

  // Reconstruct File from buffer for upload (since we consumed the arrayBuffer)
  const fileBlob = new Blob([fileBuffer], { type: file.type });

  // Detect file type
  const fileType = detectFileType(file.type, file.name);
  if (fileType === 'other') {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  // Generate unique storage path
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${userId}/${timestamp}_${safeName}`;

  // Upload to Supabase Storage
  // Use file's actual MIME type, but fall back to octet-stream if storage
  // bucket hasn't been configured with the newer MIME types (pptx, images)
  const contentType = file.type || 'application/octet-stream';

  let uploadError;
  ({ error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBlob, {
      contentType,
      upsert: false,
    }));

  // If upload fails due to MIME restriction, retry with octet-stream
  if (uploadError && uploadError.message?.includes('mime')) {
    logger.warn('Storage upload rejected MIME type, retrying with octet-stream', {
      originalMime: contentType,
      fileName: file.name,
    });
    ({ error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBlob, {
        contentType: 'application/octet-stream',
        upsert: false,
      }));
  }

  if (uploadError) {
    logger.error('Storage upload failed', { error: uploadError, contentType });
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Create document record
  const { data: document, error: dbError } = await supabaseAdmin
    .from('documents')
    .insert({
      user_id: userId,
      name: name || file.name,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      storage_bucket: STORAGE_BUCKET,
      file_type: fileType,
      status: 'pending',
      scope,
      thread_id: threadId,
      folder_id: folderId || null,
      content_hash: contentHash,
    })
    .select()
    .single();

  if (dbError || !document) {
    // Clean up storage on failure
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Failed to create document record: ${dbError?.message}`);
  }

  // Enqueue processing job via agent_jobs queue
  const { error: jobError } = await supabaseAdmin
    .from('agent_jobs')
    .insert({
      user_id: userId,
      trigger_type: 'system',
      agent_type: 'document_processor',
      priority: 'normal',
      input_message: `Process document: ${name || file.name}`,
      input_context: { documentId: document.id },
      max_retries: 3,
      status: 'pending',
    });

  if (jobError) {
    logger.error('Failed to enqueue document processing job', {
      documentId: document.id,
      error: jobError,
    });
    // Don't fail the upload - doc is saved, processing can be retried
  }

  return transformDocument(document);
}

/**
 * Process a document (parse, chunk, embed)
 */
export async function processDocument(documentId: string): Promise<void> {
  // Update status to processing
  await supabaseAdmin
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  try {
    // Get document record
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Memory guard: reject files > 50MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (doc.size_bytes > MAX_FILE_SIZE) {
      throw new Error(`File too large for processing: ${(doc.size_bytes / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit`);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(doc.storage_bucket)
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Validate magic bytes before parsing
    const rawBuffer = await fileData.arrayBuffer();
    if (!validateMagicBytes(rawBuffer, doc.file_type as FileType)) {
      throw new Error(getValidationErrorMessage(doc.file_type as FileType));
    }

    // Parse the document
    let content: ArrayBuffer | string;
    if (['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'image'].includes(doc.file_type)) {
      content = rawBuffer;
    } else {
      content = new TextDecoder().decode(rawBuffer);
    }

    const parsed = await parseDocument(content, doc.file_type as FileType, doc.original_name);

    // Generate embeddings in batches with progress updates
    const embeddingBatchSize = 100;
    const totalChunks = parsed.chunks.length;
    const embeddings: (number[] | null)[] = new Array(totalChunks).fill(null);

    for (let i = 0; i < totalChunks; i += embeddingBatchSize) {
      const batchEnd = Math.min(i + embeddingBatchSize, totalChunks);
      const batchTexts = parsed.chunks.slice(i, batchEnd).map((c) => c.content);
      const batchEmbeddings = await generateEmbeddingsBatch(batchTexts, { useCache: false });

      for (let j = 0; j < batchEmbeddings.length; j++) {
        embeddings[i + j] = batchEmbeddings[j] ?? null;
      }

      // Update processing progress in metadata (picked up by Realtime subscription)
      await supabaseAdmin
        .from('documents')
        .update({
          metadata: {
            ...parsed.metadata,
            processing_progress: `${batchEnd}/${totalChunks} chunks embedded`,
          },
        })
        .eq('id', documentId);
    }

    // Prepare chunk records
    const chunkRecords = parsed.chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: index,
      chunk_type: chunk.chunkType,
      source_page: chunk.sourcePage,
      source_line_start: chunk.sourceLineStart,
      source_line_end: chunk.sourceLineEnd,
      embedding: embeddings[index] != null ? `[${embeddings[index]!.join(',')}]` : null,
      token_count: estimateTokens(chunk.content, chunk.chunkType),
      metadata: chunk.metadata || {},
    }));

    // Insert chunks in batches
    const insertBatchSize = 50;
    for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
      const batch = chunkRecords.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabaseAdmin
        .from('document_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    // Calculate total tokens
    const totalTokens = chunkRecords.reduce((sum, c) => sum + (c.token_count || 0), 0);

    // Update document with success status
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'ready',
        metadata: parsed.metadata,
        chunk_count: chunkRecords.length,
        token_count: totalTokens,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    logger.info('Document processed successfully', {
      documentId,
      chunks: chunkRecords.length,
      tokens: totalTokens,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Document processing failed', { documentId, error: errorMessage });

    // Update with error status
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'error',
        processing_error: errorMessage,
      })
      .eq('id', documentId);

    throw error;
  }
}

/**
 * Reprocess a failed document: reset status, delete chunks, enqueue new job
 */
export async function reprocessDocument(documentId: string, userId: string): Promise<void> {
  // Verify ownership
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('documents')
    .select('id, user_id, name')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    throw new Error('Document not found');
  }
  if (doc.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Reset status and delete existing chunks
  await supabaseAdmin
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  await supabaseAdmin
    .from('documents')
    .update({
      status: 'pending',
      processing_error: null,
      chunk_count: 0,
      token_count: 0,
      processed_at: null,
    })
    .eq('id', documentId);

  // Enqueue new processing job
  const { error: jobError } = await supabaseAdmin
    .from('agent_jobs')
    .insert({
      user_id: userId,
      trigger_type: 'system',
      agent_type: 'document_processor',
      priority: 'normal',
      input_message: `Reprocess document: ${doc.name}`,
      input_context: { documentId },
      max_retries: 3,
      status: 'pending',
    });

  if (jobError) {
    throw new Error(`Failed to enqueue reprocessing job: ${jobError.message}`);
  }
}

/**
 * Search documents for relevant chunks
 */
export async function searchDocuments(
  userId: string,
  query: string,
  options: {
    limit?: number;
    minSimilarity?: number;
    scope?: DocumentScope;
    threadId?: string;
    fileTypes?: FileType[];
    folderId?: string | null;
  } = {}
): Promise<DocumentChunk[]> {
  const {
    limit = 10,
    minSimilarity = 0.7,
    scope,
    threadId,
    fileTypes,
    folderId,
  } = options;

  // Generate embedding for query
  const { generateEmbedding } = await import('@/lib/embeddings');
  const embedding = await generateEmbedding(query);

  if (!embedding) {
    logger.warn('Failed to generate embedding for search query');
    return [];
  }

  // Call search function
  const { data, error } = await supabaseAdmin.rpc('search_documents', {
    p_user_id: userId,
    p_query_embedding: `[${embedding.join(',')}]`,
    p_limit: limit,
    p_min_similarity: minSimilarity,
    p_scope: scope || null,
    p_thread_id: threadId || null,
    p_file_types: fileTypes || null,
    p_folder_id: folderId || null,
  });

  if (error) {
    logger.error('Document search failed', { error });
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.chunk_id as string,
    documentId: row.document_id as string,
    content: row.content as string,
    chunkIndex: 0,
    chunkType: row.chunk_type as DocumentChunk['chunkType'],
    sourcePage: row.source_page as number | undefined,
    metadata: {
      documentName: row.document_name,
      fileType: row.file_type,
      similarity: row.similarity,
      ...(row.metadata as Record<string, unknown>),
    },
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Get conversation context from documents
 */
export async function getConversationContext(
  userId: string,
  threadId: string,
  query: string,
  maxTokens: number = 4000
): Promise<{ content: string; sources: Array<{ name: string; similarity: number }> }> {
  const { generateEmbedding } = await import('@/lib/embeddings');
  const embedding = await generateEmbedding(query);

  if (!embedding) {
    return { content: '', sources: [] };
  }

  const { data, error } = await supabaseAdmin.rpc('get_conversation_context', {
    p_user_id: userId,
    p_thread_id: threadId,
    p_query_embedding: `[${embedding.join(',')}]`,
    p_max_tokens: maxTokens,
    p_min_similarity: 0.6,
  });

  if (error || !data || data.length === 0) {
    return { content: '', sources: [] };
  }

  const sources = data.map((row: Record<string, unknown>) => ({
    name: row.document_name as string,
    similarity: row.similarity as number,
  }));

  const content = data
    .map((row: Record<string, unknown>) => `[From ${row.document_name}]\n${row.content}`)
    .join('\n\n---\n\n');

  return { content, sources };
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string, userId: string): Promise<void> {
  // Get document to verify ownership and get storage path
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('documents')
    .select('storage_path, storage_bucket, user_id')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    throw new Error('Document not found');
  }

  if (doc.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Delete from storage
  await supabaseAdmin.storage
    .from(doc.storage_bucket)
    .remove([doc.storage_path]);

  // Delete document (chunks are deleted via CASCADE)
  const { error: deleteError } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`);
  }
}

/**
 * Get user's documents
 */
export async function getUserDocuments(
  userId: string,
  options: {
    scope?: DocumentScope;
    threadId?: string;
    status?: Document['status'];
    limit?: number;
    offset?: number;
    folderId?: string | null;
    orderBy?: 'name' | 'created_at' | 'size_bytes' | 'file_type';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ documents: Document[]; total: number }> {
  const { scope, threadId, status, limit = 50, offset = 0, folderId, orderBy = 'created_at', orderDirection = 'desc' } = options;

  const ascending = orderDirection === 'asc';

  let query = supabaseAdmin
    .from('documents')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_latest', true)
    .order(orderBy, { ascending });

  // When querying archived docs, show only archived; otherwise exclude archived
  if (status === 'archived') {
    query = query.eq('status', 'archived');
  } else {
    query = query.neq('status', 'archived');
    if (status) {
      query = query.eq('status', status);
    }
  }

  if (scope) {
    query = query.eq('scope', scope);
  }
  if (threadId) {
    query = query.eq('thread_id', threadId);
  }
  // folderId: null = root only, string = specific folder, undefined = all
  if (folderId === null) {
    query = query.is('folder_id', null);
  } else if (folderId !== undefined) {
    query = query.eq('folder_id', folderId);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return {
    documents: (data || []).map(transformDocument),
    total: count || 0,
  };
}

/**
 * Get a single document with its chunks
 */
export async function getDocumentWithChunks(
  documentId: string,
  userId: string
): Promise<Document & { chunks: DocumentChunk[] }> {
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (docError || !doc) {
    throw new Error('Document not found');
  }

  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index');

  if (chunksError) {
    throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
  }

  return {
    ...transformDocument(doc),
    chunks: (chunks || []).map(transformChunk),
  };
}

/**
 * Transform database row to Document type
 */
function transformDocument(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    storagePath: row.storage_path as string,
    storageBucket: row.storage_bucket as string,
    fileType: row.file_type as FileType,
    status: row.status as Document['status'],
    processingError: row.processing_error as string | undefined,
    scope: row.scope as DocumentScope,
    threadId: row.thread_id as string | undefined,
    folderId: (row.folder_id as string | null) || null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    chunkCount: row.chunk_count as number,
    tokenCount: row.token_count as number,
    version: (row.version as number) || 1,
    parentDocumentId: (row.parent_document_id as string | null) || null,
    isLatest: row.is_latest !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    processedAt: row.processed_at as string | undefined,
  };
}

/**
 * Transform database row to DocumentChunk type
 */
function transformChunk(row: Record<string, unknown>): DocumentChunk {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    content: row.content as string,
    chunkIndex: row.chunk_index as number,
    chunkType: row.chunk_type as DocumentChunk['chunkType'],
    sourcePage: row.source_page as number | undefined,
    sourceLineStart: row.source_line_start as number | undefined,
    sourceLineEnd: row.source_line_end as number | undefined,
    tokenCount: row.token_count as number | undefined,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
  };
}

/**
 * Transform database row to DocumentFolder type
 */
function transformFolder(row: Record<string, unknown>): DocumentFolder {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    parentId: (row.parent_id as string | null) || null,
    color: (row.color as string | null) || null,
    documentCount: (row.document_count as number) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// Folder CRUD Operations
// ============================================================================

/**
 * Create a new folder
 */
export async function createFolder(
  userId: string,
  name: string,
  parentId?: string | null,
  color?: string | null
): Promise<DocumentFolder> {
  const { data, error } = await supabaseAdmin
    .from('document_folders')
    .insert({
      user_id: userId,
      name,
      parent_id: parentId || null,
      color: color || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create folder: ${error?.message}`);
  }

  return transformFolder({ ...data, document_count: 0 });
}

/**
 * Rename a folder
 */
export async function renameFolder(
  folderId: string,
  userId: string,
  name: string
): Promise<DocumentFolder> {
  const { data, error } = await supabaseAdmin
    .from('document_folders')
    .update({ name })
    .eq('id', folderId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to rename folder: ${error?.message}`);
  }

  return transformFolder({ ...data, document_count: 0 });
}

/**
 * Delete a folder (cascade deletes subfolders, orphans documents to root)
 */
export async function deleteFolder(folderId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('document_folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
}

/**
 * Move a folder to a new parent (with circular reference check)
 */
export async function moveFolder(
  folderId: string,
  userId: string,
  newParentId: string | null
): Promise<DocumentFolder> {
  // Prevent moving a folder into itself
  if (folderId === newParentId) {
    throw new Error('Cannot move a folder into itself');
  }

  // Check for circular reference if moving to a subfolder
  if (newParentId) {
    const { data: ancestors } = await supabaseAdmin.rpc('get_folder_breadcrumb', {
      p_folder_id: newParentId,
    });

    if (ancestors?.some((a: Record<string, unknown>) => a.id === folderId)) {
      throw new Error('Cannot move a folder into one of its descendants');
    }
  }

  const { data, error } = await supabaseAdmin
    .from('document_folders')
    .update({ parent_id: newParentId })
    .eq('id', folderId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to move folder: ${error?.message}`);
  }

  return transformFolder({ ...data, document_count: 0 });
}

/**
 * Get folder tree for a user
 */
export async function getFolderTree(userId: string): Promise<FolderTreeNode[]> {
  const { data, error } = await supabaseAdmin.rpc('get_folder_tree', {
    p_user_id: userId,
  });

  if (error) {
    logger.error('Failed to get folder tree', { error });
    return [];
  }

  // Build tree from flat results
  const flatFolders = (data || []).map((row: Record<string, unknown>) => ({
    ...transformFolder(row),
    depth: row.depth as number,
  }));

  return buildFolderTree(flatFolders);
}

/**
 * Build tree structure from flat folder list
 */
function buildFolderTree(
  flatFolders: Array<DocumentFolder & { depth: number }>
): FolderTreeNode[] {
  const nodeMap = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of flatFolders) {
    const node: FolderTreeNode = {
      ...folder,
      children: [],
      depth: folder.depth,
      path: [folder.name],
    };
    nodeMap.set(folder.id, node);
  }

  for (const folder of flatFolders) {
    const node = nodeMap.get(folder.id)!;
    if (folder.parentId) {
      const parent = nodeMap.get(folder.parentId);
      if (parent) {
        parent.children.push(node);
        node.path = [...parent.path, folder.name];
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get folder contents (subfolder list + documents + breadcrumb)
 */
export async function getFolderContents(
  userId: string,
  folderId: string | null,
  options: { limit?: number; offset?: number } = {}
): Promise<FolderContents> {
  const { limit = 50, offset = 0 } = options;

  // Get folder info + breadcrumb if not root
  let folder: DocumentFolder | null = null;
  let breadcrumb: Array<{ id: string; name: string; parentId: string | null }> = [];

  if (folderId) {
    const { data: folderData, error: folderError } = await supabaseAdmin
      .from('document_folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', userId)
      .single();

    if (folderError || !folderData) {
      throw new Error('Folder not found');
    }
    folder = transformFolder({ ...folderData, document_count: 0 });

    // Get breadcrumb
    const { data: crumbData } = await supabaseAdmin.rpc('get_folder_breadcrumb', {
      p_folder_id: folderId,
    });
    breadcrumb = (crumbData || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      parentId: (row.parent_id as string | null) || null,
    }));
  }

  // Get subfolders
  let subfolderQuery = supabaseAdmin
    .from('document_folders')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (folderId) {
    subfolderQuery = subfolderQuery.eq('parent_id', folderId);
  } else {
    subfolderQuery = subfolderQuery.is('parent_id', null);
  }

  const { data: subfoldersData } = await subfolderQuery;
  const subfolders = (subfoldersData || []).map((row: Record<string, unknown>) =>
    transformFolder({ ...row, document_count: 0 })
  );

  // Get documents in this folder
  const { documents, total: totalDocuments } = await getUserDocuments(userId, {
    folderId: folderId ?? null,
    limit,
    offset,
  });

  return {
    folder,
    breadcrumb,
    subfolders,
    documents,
    totalDocuments,
  };
}

/**
 * Get folder breadcrumb
 */
export async function getFolderBreadcrumb(
  folderId: string
): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
  const { data, error } = await supabaseAdmin.rpc('get_folder_breadcrumb', {
    p_folder_id: folderId,
  });

  if (error) {
    logger.error('Failed to get breadcrumb', { error });
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string | null) || null,
  }));
}

/**
 * Move a document to a folder
 */
export async function moveDocument(
  documentId: string,
  userId: string,
  folderId: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({ folder_id: folderId })
    .eq('id', documentId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to move document: ${error.message}`);
  }
}
