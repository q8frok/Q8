'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, ChevronDown, ChevronUp, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StructuredDataRenderer } from './StructuredDataRenderer';

interface ToolResultPreviewProps {
  result: unknown;
  onCopy?: () => void;
  className?: string;
}

/**
 * Check if result should use structured rendering
 */
function shouldUseStructuredRenderer(data: unknown): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data !== 'object') return false;

  // Use structured for arrays and objects
  if (Array.isArray(data) && data.length > 0) return true;
  if (Object.keys(data).length > 0) return true;

  return false;
}

/**
 * ToolResultPreview Component
 *
 * Expandable panel showing full tool execution result
 * Uses StructuredDataRenderer for rich display of arrays and objects
 */
export function ToolResultPreview({ result, onCopy, className }: ToolResultPreviewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');

  const resultString = useMemo(() =>
    typeof result === 'string' ? result : JSON.stringify(result, null, 2),
    [result]
  );

  const useStructured = useMemo(() => shouldUseStructuredRenderer(result), [result]);
  const isTruncated = resultString.length > 500;
  const [showFull, setShowFull] = useState(false);
  const displayResult = showFull ? resultString : resultString.slice(0, 500);

  const handleCopy = () => {
    navigator.clipboard.writeText(resultString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    onCopy?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'mt-2 p-3 rounded-lg',
        'bg-surface-2 border border-border-subtle',
        'text-xs',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted font-sans text-xs">Result</span>
        <div className="flex items-center gap-1">
          {useStructured && (
            <button
              onClick={() => setViewMode(viewMode === 'structured' ? 'raw' : 'structured')}
              className={cn(
                'p-1 rounded transition-colors',
                viewMode === 'raw' ? 'bg-surface-3 text-text-primary' : 'hover:bg-surface-3 text-text-muted'
              )}
              title={viewMode === 'structured' ? 'Show raw JSON' : 'Show structured view'}
            >
              <Code className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-surface-3 transition-colors"
            title="Copy result"
          >
            {isCopied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3 text-text-muted" />
            )}
          </button>
        </div>
      </div>

      {useStructured && viewMode === 'structured' ? (
        <StructuredDataRenderer data={result} maxDepth={3} />
      ) : (
        <>
          <pre className="whitespace-pre-wrap break-words text-text-secondary font-mono">
            {displayResult}
            {isTruncated && !showFull && '...'}
          </pre>

          {isTruncated && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="flex items-center gap-1 mt-2 text-text-muted hover:text-text-primary transition-colors font-sans"
            >
              {showFull ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}

ToolResultPreview.displayName = 'ToolResultPreview';
