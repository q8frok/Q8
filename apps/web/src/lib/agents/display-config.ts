/**
 * Agent Display Configuration
 * Centralized styling and display properties for all agent types
 */

import { Bot, Code2, Home, User, Search, Calendar, DollarSign, ImageIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AgentRole =
  | 'orchestrator'
  | 'coder'
  | 'researcher'
  | 'secretary'
  | 'personality'
  | 'home'
  | 'finance'
  | 'imagegen'
  | 'user';

export interface AgentDisplayConfig {
  name: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  /** Subtle glow shadow for assistant message bubbles */
  glowColor?: string;
  description?: string;
  /** Model name for display purposes */
  model?: string;
}

/**
 * Display configuration for each agent type
 * Used across chat components for consistent styling
 */
export const AGENT_DISPLAY_CONFIG: Record<AgentRole, AgentDisplayConfig> = {
  orchestrator: {
    name: 'Q8 Orchestrator',
    icon: Bot,
    iconColor: 'text-neon-primary',
    bgColor: 'bg-neon-primary/20',
    glowColor: 'shadow-[0_0_12px_rgba(139,92,246,0.15)]',
    description: 'Main routing agent',
    model: 'GPT-5.2',
  },
  coder: {
    name: 'DevBot',
    icon: Code2,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(59,130,246,0.15)]',
    description: 'Code and development specialist',
    model: 'Claude Opus 4.5',
  },
  researcher: {
    name: 'Research Agent',
    icon: Search,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]',
    description: 'Web search and research',
    model: 'Sonar Reasoning Pro',
  },
  secretary: {
    name: 'Secretary',
    icon: Calendar,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(34,197,94,0.15)]',
    description: 'Email, calendar, and scheduling',
    model: 'Gemini 3 Flash',
  },
  personality: {
    name: 'Grok',
    icon: Bot,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(249,115,22,0.15)]',
    description: 'Casual conversation and creativity',
    model: 'Grok 4.1',
  },
  home: {
    name: 'HomeBot',
    icon: Home,
    iconColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]',
    description: 'Smart home control',
    model: 'GPT-5-mini',
  },
  finance: {
    name: 'Finance Advisor',
    icon: DollarSign,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    description: 'Personal finance and budgeting',
    model: 'Gemini 3 Flash',
  },
  imagegen: {
    name: 'ImageGen',
    icon: ImageIcon,
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-500/20',
    glowColor: 'shadow-[0_0_12px_rgba(236,72,153,0.15)]',
    description: 'AI image generation and analysis',
    model: 'gpt-image-1.5',
  },
  user: {
    name: 'You',
    icon: User,
    iconColor: 'text-neon-primary',
    bgColor: 'bg-neon-primary/20',
  },
};

/**
 * Get display configuration for an agent
 */
export function getAgentDisplayConfig(role: AgentRole): AgentDisplayConfig {
  return AGENT_DISPLAY_CONFIG[role] || AGENT_DISPLAY_CONFIG.orchestrator;
}

/**
 * Get agent name by role
 */
export function getAgentName(role: AgentRole): string {
  return AGENT_DISPLAY_CONFIG[role]?.name || 'Assistant';
}

/**
 * Get agent icon by role
 */
export function getAgentIcon(role: AgentRole): LucideIcon {
  return AGENT_DISPLAY_CONFIG[role]?.icon || Bot;
}
