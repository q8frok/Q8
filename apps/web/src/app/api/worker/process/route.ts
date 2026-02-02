/**
 * Deep Thinker Worker API
 *
 * Processes background jobs from the agent_jobs queue.
 * Can be triggered by:
 * - Vercel Cron (scheduled)
 * - External webhook
 * - Manual invocation
 *
 * Usage:
 * - POST /api/worker/process - Process a batch of jobs
 * - GET /api/worker/process - Get queue statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { processBatch, getQueueStats, cleanupStaleJobs } from '@/lib/agents/deep-thinker';
import { processDocumentJob } from '@/lib/documents/worker';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ExtendedAgentType } from '@/lib/agents/orchestration/types';

// Vercel cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for cron jobs

/**
 * Verify the request is authorized
 * Accepts Vercel cron secret or API key
 */
function verifyAuthorization(request: NextRequest): boolean {
  // Check for Vercel cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check for internal API key
  const apiKey = request.headers.get('x-api-key');
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (internalApiKey && apiKey === internalApiKey) {
    return true;
  }

  // In development, allow unauthenticated access
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

/**
 * POST /api/worker/process
 * Process a batch of pending jobs
 */
export async function POST(request: NextRequest) {
  if (!verifyAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse optional configuration from body
    let config: {
      agentTypes?: ExtendedAgentType[];
      batchSize?: number;
      concurrency?: number;
    } = {};

    try {
      const body = await request.json();
      config = {
        agentTypes: body.agentTypes,
        batchSize: body.batchSize ?? 10,
        concurrency: body.concurrency ?? 3,
      };
    } catch {
      // No body or invalid JSON, use defaults
    }

    const workerId = `api-worker-${Date.now()}`;

    logger.info('[Worker API] Starting batch processing', {
      workerId,
      config,
    });

    // Process document_processor jobs separately
    const docResult = await processDocumentBatch(workerId);

    const result = await processBatch({
      workerId,
      ...config,
    });

    logger.info('[Worker API] Batch processing complete', {
      workerId,
      result: {
        processed: result.processed + docResult.processed,
        succeeded: result.succeeded + docResult.succeeded,
        failed: result.failed + docResult.failed,
      },
    });

    return NextResponse.json({
      success: true,
      processed: result.processed + docResult.processed,
      succeeded: result.succeeded + docResult.succeeded,
      failed: result.failed + docResult.failed,
      jobs: [...result.jobs, ...docResult.jobs],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Worker API] Processing failed', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Process document_processor jobs from the queue
 */
async function processDocumentBatch(
  workerId: string,
  batchSize = 5
): Promise<{ processed: number; succeeded: number; failed: number; jobs: Array<{ jobId: string; status: string; durationMs: number; error?: string }> }> {
  const result = { processed: 0, succeeded: 0, failed: 0, jobs: [] as Array<{ jobId: string; status: string; durationMs: number; error?: string }> };

  for (let i = 0; i < batchSize; i++) {
    // Claim a document_processor job
    const { data: jobs, error: claimError } = await supabaseAdmin
      .from('agent_jobs')
      .select('*')
      .eq('agent_type', 'document_processor')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (claimError || !jobs || jobs.length === 0) break;

    const job = jobs[0]!;

    // Mark as processing
    const { error: updateError } = await supabaseAdmin
      .from('agent_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending'); // Atomic claim

    if (updateError) continue; // Another worker claimed it

    const startTime = Date.now();
    result.processed++;

    try {
      const jobResult = await processDocumentJob(job);
      const durationMs = Date.now() - startTime;

      if (jobResult.success) {
        await supabaseAdmin.rpc('complete_job', {
          p_job_id: job.id,
          p_output_content: jobResult.content || '',
          p_output_metadata: { durationMs, workerId },
          p_tool_executions: null,
        });
        result.succeeded++;
        result.jobs.push({ jobId: job.id, status: 'completed', durationMs });
      } else {
        await supabaseAdmin.rpc('fail_job', {
          p_job_id: job.id,
          p_error_message: jobResult.error || 'Unknown error',
          p_error_code: 'DOC_PROCESSING_ERROR',
        });
        result.failed++;
        result.jobs.push({ jobId: job.id, status: 'failed', durationMs, error: jobResult.error });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await supabaseAdmin.rpc('fail_job', {
        p_job_id: job.id,
        p_error_message: errorMessage,
        p_error_code: 'DOC_WORKER_ERROR',
      });
      result.failed++;
      result.jobs.push({ jobId: job.id, status: 'failed', durationMs, error: errorMessage });
    }
  }

  return result;
}

/**
 * GET /api/worker/process
 * Get queue statistics
 */
export async function GET(request: NextRequest) {
  if (!verifyAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [stats, cleanedUp] = await Promise.all([
      getQueueStats(),
      cleanupStaleJobs(),
    ]);

    return NextResponse.json({
      success: true,
      stats,
      staleJobsCleaned: cleanedUp,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Worker API] Failed to get stats', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
