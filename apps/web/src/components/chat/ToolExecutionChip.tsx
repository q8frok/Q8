'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToolIcon } from './toolIconMap';
import { getToolDisplayName } from './toolDisplayNames';
import { ToolResultPreview } from './ToolResultPreview';
import { RichToolResult, hasRichRenderer } from './RichToolResult';

export type ToolStatus = 'running' | 'completed' | 'failed';

interface ToolExecutionChipProps {
  /**
   * Tool name
   */
  tool: string;

  /**
   * Execution status
   */
  status: ToolStatus;

  /**
   * Tool arguments (for display)
   */
  args?: Record<string, unknown>;

  /**
   * Result summary (for completed tools)
   */
  result?: unknown;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show expanded details
   */
  expanded?: boolean;

  /**
   * Click handler
   */
  onClick?: () => void;
}

/**
 * ToolExecutionChip Component
 *
 * Shows a tool being executed with status, icon, and expandable result preview
 */
export function ToolExecutionChip({
  tool,
  status,
  args,
  result,
  className,
  expanded = false,
  onClick,
}: ToolExecutionChipProps) {
  const [showResult, setShowResult] = useState(false);
  const Icon = getToolIcon(tool);
  const displayName = getToolDisplayName(tool);

  const handleClick = () => {
    if (status !== 'running' && result !== undefined) {
      setShowResult(!showResult);
    }
    onClick?.();
  };

  return (
    <div className="inline-block">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-full text-sm min-h-[36px]',
          'border transition-all cursor-pointer active:scale-[0.97]',
          status === 'running' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          status === 'completed' && 'bg-green-500/10 border-green-500/30 text-green-400',
          status === 'failed' && 'bg-red-500/10 border-red-500/30 text-red-400',
          className
        )}
        onClick={handleClick}
      >
        {/* Status Icon */}
        <AnimatePresence mode="wait">
          {status === 'running' ? (
            <motion.div
              key="running"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-4 w-4" />
            </motion.div>
          ) : status === 'completed' ? (
            <motion.div
              key="completed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="failed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <X className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tool Icon */}
        <Icon className="h-4 w-4" />

        {/* Tool Name */}
        <span className="font-medium">{displayName}</span>

        {/* Expand indicator when result available */}
        {status !== 'running' && result !== undefined && (
          <motion.div
            animate={{ rotate: showResult ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 opacity-60" />
          </motion.div>
        )}

        {/* Args summary (if expanded and no result shown) */}
        {expanded && !showResult && args && Object.keys(args).length > 0 && (
          <span className="text-xs opacity-60">
            {Object.entries(args)
              .slice(0, 2)
              .map(([key, value]) => `${key}: ${String(value).slice(0, 20)}`)
              .join(', ')}
          </span>
        )}
      </motion.div>

      {/* Result Preview */}
      <AnimatePresence>
        {showResult && result !== undefined && (
          <div className="mt-2 max-h-[200px] overflow-y-auto scrollbar-thin">
            {hasRichRenderer(tool, result)
              ? <RichToolResult toolName={tool} result={result} />
              : <ToolResultPreview result={result} />
            }
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * ToolExecutionList Component
 *
 * Shows a list of tool executions
 */
interface ToolExecutionListProps {
  tools: Array<{
    id: string;
    tool: string;
    status: ToolStatus;
    args?: Record<string, unknown>;
    result?: unknown;
  }>;
  className?: string;
}

export function ToolExecutionList({ tools, className }: ToolExecutionListProps) {
  if (tools.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2 my-2', className)}>
      <AnimatePresence>
        {tools.map((tool) => (
          <ToolExecutionChip
            key={tool.id}
            tool={tool.tool}
            status={tool.status}
            args={tool.args}
            result={tool.result}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

ToolExecutionChip.displayName = 'ToolExecutionChip';
ToolExecutionList.displayName = 'ToolExecutionList';
