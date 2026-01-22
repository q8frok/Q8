'use client';

import { motion } from 'framer-motion';

export interface Agent {
  id: string;
  name: string;
  icon: string;
}

interface AgentMentionsDropdownProps {
  agents: Agent[];
  onSelect: (agentId: string) => void;
  visible: boolean;
}

export function AgentMentionsDropdown({ agents, onSelect, visible }: AgentMentionsDropdownProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-0 right-0 mb-2 surface-matte rounded-xl shadow-lg overflow-hidden z-20"
    >
      <div className="p-2">
        <p className="text-xs text-text-muted px-2 py-1">
          Mention an agent
        </p>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors focus-ring"
          >
            <span className="text-xl">{agent.icon}</span>
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">{agent.name}</p>
              <p className="text-xs text-text-muted">@{agent.id}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
