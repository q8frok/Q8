'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, BookOpen, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';
import { springBouncy } from '@/lib/animations/springs';

interface VoiceFABProps {
  onVoice: () => void;
  onSettings: () => void;
  onKnowledge: () => void;
  onChat?: () => void;
}

const SPRING = springBouncy;

export function VoiceFAB({ onVoice, onSettings, onKnowledge, onChat }: VoiceFABProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    haptics.medium();
    setExpanded(!expanded);
  };

  const handleAction = (action: () => void) => {
    haptics.light();
    action();
    setExpanded(false);
  };

  // Action buttons in vertical stack from bottom: Settings (-72), Voice (-144), Knowledge (-216), Chat (-288)
  const actions = [
    {
      key: 'settings',
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
      onClick: onSettings,
      y: -72,
      style: 'bg-surface-2 border border-border-subtle',
      ariaLabel: 'Open Settings',
    },
    {
      key: 'voice',
      label: 'Voice',
      icon: <Mic className="h-5 w-5" />,
      onClick: onVoice,
      y: -144,
      style: 'bg-neon-primary shadow-neon-primary/30',
      ariaLabel: 'Voice Mode',
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      icon: <BookOpen className="h-5 w-5" />,
      onClick: onKnowledge,
      y: -216,
      style: 'bg-surface-2 border border-border-subtle',
      ariaLabel: 'Open Knowledge Base',
    },
    ...(onChat
      ? [
          {
            key: 'chat',
            label: 'Chat',
            icon: <MessageCircle className="h-5 w-5" />,
            onClick: onChat,
            y: -288,
            style: 'bg-neon-primary/20 border border-neon-primary/30',
            ariaLabel: 'Open Chat',
          },
        ]
      : []),
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 lg:hidden fab-container">
      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30"
              onClick={() => {
                haptics.light();
                setExpanded(false);
              }}
            />

            {/* Action buttons with labels */}
            {actions.map((action, index) => (
              <motion.button
                key={action.key}
                initial={{ scale: 0, y: 0, opacity: 0 }}
                animate={{ scale: 1, y: action.y, opacity: 1 }}
                exit={{ scale: 0, y: 0, opacity: 0 }}
                transition={{ ...SPRING, delay: index * 0.03 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAction(action.onClick)}
                className={cn(
                  'absolute bottom-0 right-0 h-14 w-14 rounded-full flex items-center justify-center shadow-lg',
                  action.style
                )}
                aria-label={action.ariaLabel}
              >
                {action.icon}
              </motion.button>
            ))}

            {/* Labels next to buttons */}
            {actions.map((action, index) => (
              <motion.span
                key={`${action.key}-label`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15, delay: index * 0.05 + 0.05 }}
                className="absolute bottom-0 right-[4.5rem] text-sm font-medium text-white whitespace-nowrap pointer-events-none"
                style={{ transform: `translateY(${action.y}px)`, lineHeight: '3.5rem' }}
              >
                {action.label}
              </motion.span>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB - 64px for better thumb target */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={toggleExpanded}
        transition={SPRING}
        className={cn(
          'relative h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-colors',
          expanded
            ? 'bg-surface-3 border border-border-subtle'
            : 'bg-neon-primary shadow-neon-primary/30'
        )}
        aria-label={expanded ? 'Close menu' : 'Open menu'}
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Mic className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
