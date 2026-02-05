import {
  Bot,
  User,
  Code2,
  Search,
  Calendar,
  Sparkles,
  Home,
  ImageIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AgentRole = 'orchestrator' | 'coder' | 'researcher' | 'secretary' | 'personality' | 'home' | 'finance' | 'imagegen';

export interface AgentConfig {
  name: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

/**
 * Get agent configuration for rendering avatar and label
 */
export function getAgentConfig(role: AgentRole | 'user'): AgentConfig {
  const configs: Record<AgentRole | 'user', AgentConfig> = {
    user: {
      name: 'You',
      icon: User,
      bgColor: 'bg-neon-primary/20',
      iconColor: 'text-neon-primary',
    },
    orchestrator: {
      name: 'Q8',
      icon: Bot,
      bgColor: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
    coder: {
      name: 'DevBot',
      icon: Code2,
      bgColor: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    researcher: {
      name: 'ResearchBot',
      icon: Search,
      bgColor: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    secretary: {
      name: 'SecretaryBot',
      icon: Calendar,
      bgColor: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
    },
    personality: {
      name: 'Q8',
      icon: Sparkles,
      bgColor: 'bg-pink-500/20',
      iconColor: 'text-pink-400',
    },
    home: {
      name: 'HomeBot',
      icon: Home,
      bgColor: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    finance: {
      name: 'FinanceBot',
      icon: Sparkles,
      bgColor: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    imagegen: {
      name: 'ImageBot',
      icon: ImageIcon,
      bgColor: 'bg-pink-500/20',
      iconColor: 'text-pink-500',
    },
  };

  return configs[role] ?? configs.orchestrator;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
