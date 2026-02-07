'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAgentDisplayConfig, type AgentRole } from '@/lib/agents/display-config';

type HandoffState = 'pending' | 'thinking' | 'active' | 'complete';

interface AgentHandoffProps {
  /**
   * Source agent (usually orchestrator)
   */
  from?: AgentRole;

  /**
   * Target agent
   */
  to: AgentRole;

  /**
   * Routing reason
   */
  reason?: string;

  /**
   * Confidence score for routing decision (0-1)
   */
  confidence?: number;

  /**
   * Whether to show the animation
   */
  visible?: boolean;

  /**
   * Current handoff state
   */
  state?: HandoffState;

  /**
   * Show thinking state between handoff and first content
   */
  showThinking?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Get agent configuration for handoff display
 * Derives borderColor from bgColor pattern (bg-X-500/20 → border-X-500/30)
 */
function getHandoffConfig(role: AgentRole | string | undefined) {
  const display = getAgentDisplayConfig((role || 'orchestrator') as AgentRole);
  const borderColor = display.bgColor.replace('bg-', 'border-').replace('/20', '/30');
  return {
    name: display.name,
    icon: display.icon,
    bgColor: display.bgColor,
    iconColor: display.iconColor,
    borderColor,
  };
}

/**
 * Get confidence level indicator
 */
function getConfidenceIndicator(confidence: number): { color: string; label: string; icon: typeof CheckCircle2 } {
  if (confidence >= 0.8) {
    return { color: 'text-green-400', label: 'High confidence', icon: CheckCircle2 };
  }
  if (confidence >= 0.5) {
    return { color: 'text-yellow-400', label: 'Medium confidence', icon: AlertCircle };
  }
  return { color: 'text-gray-400', label: 'Low confidence', icon: AlertCircle };
}

/**
 * AgentHandoff Component
 *
 * Shows an animated transition when routing to a different agent
 * Now includes thinking state, confidence indicator, and enhanced animations
 */
export function AgentHandoff({
  from = 'orchestrator',
  to,
  reason,
  confidence,
  visible = true,
  state = 'pending',
  showThinking = false,
  className,
}: AgentHandoffProps) {
  const [internalState, setInternalState] = useState<HandoffState>(state);
  const fromConfig = getHandoffConfig(from);
  const toConfig = getHandoffConfig(to);

  // Handle state transitions
  useEffect(() => {
    setInternalState(state);
  }, [state]);

  // Auto-transition from pending to thinking after animation completes
  useEffect(() => {
    if (visible && showThinking && internalState === 'pending') {
      const timer = setTimeout(() => setInternalState('thinking'), 800);
      return () => clearTimeout(timer);
    }
  }, [visible, showThinking, internalState]);

  const confidenceInfo = confidence !== undefined
    ? getConfidenceIndicator(confidence)
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={cn('py-3', className)}
        >
          {/* Handoff Animation */}
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {/* From Agent */}
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 0.9, 1] }}
              transition={{ duration: 0.5 }}
              style={{ willChange: 'transform, opacity' }}
              className={cn(
                'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border',
                fromConfig.bgColor,
                fromConfig.borderColor
              )}
            >
              <fromConfig.icon className={cn('h-4 w-4 sm:h-5 sm:w-5', fromConfig.iconColor)} />
              <span className="text-xs sm:text-sm font-medium">{fromConfig.name}</span>
            </motion.div>

            {/* Arrow Animation — simplified fade on mobile */}
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              style={{ willChange: 'transform' }}
            >
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-text-muted" />
            </motion.div>

            {/* To Agent */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              style={{ willChange: 'transform, opacity' }}
              className={cn(
                'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border',
                toConfig.bgColor,
                toConfig.borderColor,
                'ring-2 ring-offset-2 ring-offset-background',
                toConfig.borderColor.replace('border-', 'ring-')
              )}
            >
              <motion.div
                animate={internalState === 'thinking' ? { rotate: 360 } : { rotate: [0, 10, -10, 0] }}
                transition={
                  internalState === 'thinking'
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.5, delay: 0.5 }
                }
              >
                {internalState === 'thinking' ? (
                  <Loader2 className={cn('h-5 w-5', toConfig.iconColor)} />
                ) : (
                  <toConfig.icon className={cn('h-5 w-5', toConfig.iconColor)} />
                )}
              </motion.div>
              <span className="text-xs sm:text-sm font-medium">{toConfig.name}</span>
            </motion.div>
          </div>

          {/* Reason and Confidence */}
          <div className="flex flex-col items-center gap-1 mt-2">
            {/* Routing Reason */}
            {reason && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center text-xs text-text-muted"
              >
                {reason}
              </motion.p>
            )}

            {/* Confidence Indicator */}
            {confidenceInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1"
              >
                <confidenceInfo.icon className={cn('h-3 w-3', confidenceInfo.color)} />
                <span className={cn('text-[10px]', confidenceInfo.color)}>
                  {confidenceInfo.label} ({Math.round((confidence ?? 0) * 100)}%)
                </span>
              </motion.div>
            )}

            {/* Thinking State Indicator */}
            {internalState === 'thinking' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-2 mt-1"
              >
                <span className="text-xs text-text-muted">Processing request...</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact Agent Badge Component
 *
 * Shows just the target agent with a subtle animation
 */
interface AgentBadgeProps {
  agent: AgentRole;
  isActive?: boolean;
  className?: string;
}

export function AgentBadge({ agent, isActive = false, className }: AgentBadgeProps) {
  const config = getHandoffConfig(agent);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
        'border',
        config.bgColor,
        config.borderColor,
        isActive && 'ring-1 ring-neon-primary',
        className
      )}
    >
      <config.icon className={cn('h-3 w-3', config.iconColor)} />
      <span className="font-medium">{config.name}</span>
    </motion.div>
  );
}

AgentHandoff.displayName = 'AgentHandoff';
AgentBadge.displayName = 'AgentBadge';
