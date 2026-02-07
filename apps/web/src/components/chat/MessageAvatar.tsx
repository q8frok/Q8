'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AgentConfig } from './messageUtils';

interface MessageAvatarProps {
  agentConfig: AgentConfig;
  isStreaming?: boolean;
}

/**
 * Animated avatar for chat messages
 */
export function MessageAvatar({ agentConfig, isStreaming = false }: MessageAvatarProps) {
  const IconComponent = agentConfig.icon;

  return (
    <div className="flex-shrink-0">
      <motion.div
        className={cn(
          'relative h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center overflow-hidden',
          agentConfig.bgColor
        )}
        animate={isStreaming ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1, repeat: isStreaming ? Infinity : 0 }}
      >
        <IconComponent className={cn('h-5 w-5', agentConfig.iconColor)} />
      </motion.div>
    </div>
  );
}

MessageAvatar.displayName = 'MessageAvatar';
