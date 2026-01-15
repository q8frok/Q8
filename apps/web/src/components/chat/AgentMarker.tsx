'use client';

import { motion } from 'framer-motion';
import {
  Code2,
  Search,
  Calendar,
  Home,
  DollarSign,
  MessageCircle,
  Cpu,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtendedAgentType } from '@/lib/agents/orchestration';

interface AgentMarkerProps {
  agent: ExtendedAgentType | string;
  reason?: string;
  confidence?: number;
  showDetails?: boolean;
  className?: string;
}

/**
 * Agent configuration for display
 */
type AgentConfig = {
  name: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
};

const DEFAULT_CONFIG: AgentConfig = {
  name: 'Q8',
  icon: MessageCircle,
  color: 'text-neon-primary',
  bgColor: 'bg-neon-primary/10',
};

const AGENT_CONFIG: Record<string, AgentConfig> = {
  coder: {
    name: 'DevBot',
    icon: Code2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  researcher: {
    name: 'ResearchBot',
    icon: Search,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  secretary: {
    name: 'SecretaryBot',
    icon: Calendar,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  home: {
    name: 'HomeBot',
    icon: Home,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  finance: {
    name: 'FinanceAdvisor',
    icon: DollarSign,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  personality: {
    name: 'Q8',
    icon: MessageCircle,
    color: 'text-neon-primary',
    bgColor: 'bg-neon-primary/10',
  },
  orchestrator: {
    name: 'Q8',
    icon: Cpu,
    color: 'text-neon-primary',
    bgColor: 'bg-neon-primary/10',
  },
};

/**
 * AgentMarker - Shows which agent is handling the response
 * Displays agent name, icon, and optional routing details
 */
export function AgentMarker({
  agent,
  reason,
  confidence,
  showDetails = false,
  className,
}: AgentMarkerProps) {
  const config = AGENT_CONFIG[agent] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5',
        config.bgColor,
        'border border-border-subtle/50',
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', config.color)} />
      <span className={cn('text-xs font-medium', config.color)}>
        {config.name}
      </span>

      {showDetails && confidence !== undefined && (
        <span className="text-xs text-text-muted/70">
          {Math.round(confidence * 100)}%
        </span>
      )}

      {showDetails && reason && (
        <span className="text-xs text-text-muted max-w-[200px] truncate">
          • {reason}
        </span>
      )}
    </motion.div>
  );
}

/**
 * AgentSegmentDivider - Shows when agent changes during a conversation
 */
interface AgentSegmentDividerProps {
  fromAgent?: string;
  toAgent: string;
  reason?: string;
}

export function AgentSegmentDivider({
  fromAgent,
  toAgent,
  reason,
}: AgentSegmentDividerProps) {
  const toConfig = AGENT_CONFIG[toAgent] ?? DEFAULT_CONFIG;
  const ToIcon = toConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.9 }}
      animate={{ opacity: 1, scaleX: 1 }}
      className="flex items-center gap-3 py-2"
    >
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent" />

      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-3/50">
        {fromAgent && (
          <>
            <span className="text-xs text-text-muted">Handoff to</span>
          </>
        )}
        <ToIcon className={cn('h-3 w-3', toConfig.color)} />
        <span className={cn('text-xs font-medium', toConfig.color)}>
          {toConfig.name}
        </span>
        {reason && (
          <span className="text-xs text-text-muted">
            • {reason}
          </span>
        )}
      </div>

      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
    </motion.div>
  );
}

/**
 * CompactAgentBadge - Minimal agent indicator for message headers
 */
export function CompactAgentBadge({
  agent,
  className,
}: {
  agent: string;
  className?: string;
}) {
  const config = AGENT_CONFIG[agent] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
        config.bgColor,
        className
      )}
      title={config.name}
    >
      <Icon className={cn('h-3 w-3', config.color)} />
      <span className={cn('text-[10px] font-medium uppercase tracking-wide', config.color)}>
        {agent === 'personality' ? 'Q8' : agent}
      </span>
    </div>
  );
}

AgentMarker.displayName = 'AgentMarker';
AgentSegmentDivider.displayName = 'AgentSegmentDivider';
CompactAgentBadge.displayName = 'CompactAgentBadge';
