/**
 * Document Processing Worker
 * Handles document_processor jobs from the agent_jobs queue
 */

import { processDocument } from './processor';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Process a document processing job from the agent_jobs queue
 */
export async function processDocumentJob(job: {
  id: string;
  input_context: { documentId?: string };
}): Promise<{ success: boolean; content?: string; error?: string }> {
  const documentId = job.input_context?.documentId;

  if (!documentId) {
    return { success: false, error: 'Missing documentId in job context' };
  }

  try {
    await processDocument(documentId);

    // Fetch the processed document for summary
    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('name, chunk_count, token_count')
      .eq('id', documentId)
      .single();

    const summary = doc
      ? `Processed "${doc.name}": ${doc.chunk_count} chunks, ${doc.token_count} tokens`
      : `Processed document ${documentId}`;

    return { success: true, content: summary };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    logger.error('[DocWorker] Processing failed', { documentId, error: errorMessage });

    // Update document status to error
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'error',
        processing_error: errorMessage,
      })
      .eq('id', documentId);

    return { success: false, error: errorMessage };
  }
}
