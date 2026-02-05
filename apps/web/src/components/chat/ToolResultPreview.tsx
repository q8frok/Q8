'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolResultPreviewProps {
  result: unknown;
  onCopy?: () => void;
  className?: string;
}

/**
 * ToolResultPreview Component
 *
 * Expandable panel showing full tool execution result
 */
export function ToolResultPreview({ result, onCopy, className }: ToolResultPreviewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
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
        'text-xs font-mono',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted font-sans text-xs">Result</span>
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

      <pre className="whitespace-pre-wrap break-words text-text-secondary">
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
    </motion.div>
  );
}

ToolResultPreview.displayName = 'ToolResultPreview';
