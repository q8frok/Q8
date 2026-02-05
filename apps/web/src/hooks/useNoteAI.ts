'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export type NoteAIOperation =
  | 'summarize'
  | 'expand'
  | 'rewrite-formal'
  | 'rewrite-casual'
  | 'extract-tasks';

interface NoteAIResult {
  content: string;
  operation: NoteAIOperation;
}

interface UseNoteAIReturn {
  isProcessing: boolean;
  lastResult: NoteAIResult | null;
  lastError: string | null;
  processNote: (content: string, operation: NoteAIOperation) => Promise<string | null>;
  clearResult: () => void;
}

const OPERATION_LABELS: Record<NoteAIOperation, string> = {
  summarize: 'Summarize',
  expand: 'Expand',
  'rewrite-formal': 'Rewrite (Formal)',
  'rewrite-casual': 'Rewrite (Casual)',
  'extract-tasks': 'Extract Tasks',
};

export { OPERATION_LABELS };

export function useNoteAI(): UseNoteAIReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<NoteAIResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const processNote = useCallback(
    async (content: string, operation: NoteAIOperation): Promise<string | null> => {
      if (!content.trim()) {
        setLastError('Note content is empty');
        return null;
      }

      setIsProcessing(true);
      setLastError(null);

      try {
        const response = await fetch('/api/notes/ai-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, operation }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message = data?.error?.message || `AI assist failed (${response.status})`;
          setLastError(message);
          return null;
        }

        const data = await response.json();
        const result: NoteAIResult = {
          content: data.result,
          operation,
        };
        setLastResult(result);
        return data.result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI assist request failed';
        logger.error('Note AI assist failed', { error, operation });
        setLastError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const clearResult = useCallback(() => {
    setLastResult(null);
    setLastError(null);
  }, []);

  return {
    isProcessing,
    lastResult,
    lastError,
    processNote,
    clearResult,
  };
}
