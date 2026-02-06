'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getAgentDisplayConfig, type AgentRole } from '@/lib/agents/display-config';

interface AgentIndicatorProps {
  /**
   * Currently active agent
   */
  agent: AgentRole;

  /**
   * Agent display name
   */
  agentName?: string;

  /**
   * Show typing animation
   * @default true
   */
  showTyping?: boolean;

  /**
   * Current task description
   */
  task?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Agent Indicator Component
 *
 * Shows which sub-agent is currently responding with typing animation
 * and agent metadata.
 *
 * Features:
 * - Agent-specific icons and colors
 * - Typing animation (three bouncing dots)
 * - Current task description
 * - Model name display
 *
 * @example
 * ```tsx
 * // Orchestrator thinking
 * <AgentIndicator
 *   agent="orchestrator"
 *   task="Routing your request..."
 * />
 *
 * // Coder working
 * <AgentIndicator
 *   agent="coder"
 *   agentName="DevBot"
 *   task="Analyzing authentication code..."
 * />
 *
 * // Without typing animation
 * <AgentIndicator
 *   agent="researcher"
 *   showTyping={false}
 * />
 * ```
 */
export function AgentIndicator({
  agent,
  agentName,
  showTyping = true,
  task,
  className,
}: AgentIndicatorProps) {
  const agentConfig = getAgentDisplayConfig(agent);
  const AgentIcon = agentConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('flex items-center gap-3 surface-matte rounded-xl p-4', className)}
    >
      {/* Agent Icon */}
      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', agentConfig.bgColor)}>
        <AgentIcon className={cn('h-5 w-5', agentConfig.iconColor)} />
      </div>

      {/* Agent Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {agentName || agentConfig.name}
          </span>
          {agentConfig.model && (
            <span className="text-xs text-text-muted">
              ({agentConfig.model})
            </span>
          )}
        </div>

        {task && (
          <p className="text-xs text-text-muted truncate mt-0.5">
            {task}
          </p>
        )}
      </div>

      {/* Typing Animation */}
      {showTyping && (
        <div className="flex gap-1">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            className="h-2 w-2 rounded-full bg-neon-primary"
          />
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
            className="h-2 w-2 rounded-full bg-neon-primary"
          />
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
            className="h-2 w-2 rounded-full bg-neon-primary"
          />
        </div>
      )}
    </motion.div>
  );
}

AgentIndicator.displayName = 'AgentIndicator';
