'use client';

import { motion } from 'framer-motion';
import { Brain, Loader2 } from 'lucide-react';
import type { PipelineState } from '@/hooks/useChat';

interface ThinkingIndicatorProps {
  pipelineState: PipelineState;
  pipelineDetail?: string | null;
  isReasoning?: boolean;
  agentName?: string;
}

const STATE_CONFIG: Record<string, { icon: 'brain' | 'loader'; label: string; color: string }> = {
  routing: { icon: 'loader', label: 'Routing', color: 'text-blue-400' },
  thinking: { icon: 'brain', label: 'Thinking', color: 'text-purple-400' },
  tool_executing: { icon: 'loader', label: 'Running tool', color: 'text-amber-400' },
  composing: { icon: 'loader', label: 'Writing', color: 'text-neon-primary' },
};

/**
 * Compact thinking/pipeline state indicator shown below the assistant message
 * while it's streaming. Displays the current stage of the agent pipeline.
 */
export function ThinkingIndicator({
  pipelineState,
  pipelineDetail,
  isReasoning,
}: ThinkingIndicatorProps) {
  // Don't show for 'done' or null
  if (!pipelineState || pipelineState === 'done') return null;

  const config = isReasoning
    ? { icon: 'brain' as const, label: 'Deep reasoning', color: 'text-purple-400' }
    : STATE_CONFIG[pipelineState] ?? { icon: 'loader' as const, label: pipelineState, color: 'text-zinc-400' };

  const displayText = pipelineDetail || config.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-surface-3/50 via-surface-3/30 to-surface-3/50 bg-[length:200%_100%] animate-shimmer"
    >
      {config.icon === 'brain' ? (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Brain className={`h-3.5 w-3.5 ${config.color}`} />
        </motion.div>
      ) : (
        <Loader2 className={`h-3.5 w-3.5 animate-spin ${config.color}`} />
      )}

      <span className={`text-xs font-medium ${config.color}`}>
        {displayText}
      </span>

      {/* Animated dots */}
      <span className="flex gap-0.5" style={{ willChange: 'opacity' }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`inline-block w-1 h-1 rounded-full ${config.color} bg-current`}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </span>
    </motion.div>
  );
}

ThinkingIndicator.displayName = 'ThinkingIndicator';
