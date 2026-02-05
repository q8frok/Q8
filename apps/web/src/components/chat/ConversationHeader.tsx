'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AgentBadge } from './AgentHandoff';
import type { ConversationMode } from '@/hooks/useUnifiedChat';
import type { AgentType } from '@/hooks/useChat';
import { MODE_CONFIG } from './modeConfig';

interface ConversationHeaderProps {
  mode: ConversationMode;
  activeAgent: string | null;
  agentStack: string[];
  isStreaming: boolean;
  ttsEnabled: boolean;
  messagesCount: number;
  showSidebarToggle: boolean;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
  onSwitchMode: (mode: ConversationMode) => void;
  onToggleTTS: () => void;
  onClearMessages: () => void;
}

export function ConversationHeader({
  mode,
  activeAgent,
  agentStack,
  isStreaming,
  ttsEnabled,
  messagesCount,
  showSidebarToggle,
  sidebarOpen,
  onToggleSidebar,
  onSwitchMode,
  onToggleTTS,
  onClearMessages,
}: ConversationHeaderProps) {
  const [showModeSelector, setShowModeSelector] = useState(false);
  const CurrentModeIcon = MODE_CONFIG[mode].icon;

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle */}
        {showSidebarToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="h-8 w-8 p-0"
            title={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
          >
            <PanelLeft
              className={cn('h-4 w-4 transition-transform', sidebarOpen && 'text-neon-primary')}
            />
          </Button>
        )}

        {/* Mode Selector */}
        <div className="relative">
          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors',
              'bg-surface-3 hover:bg-border-subtle',
              MODE_CONFIG[mode].color
            )}
          >
            <CurrentModeIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{MODE_CONFIG[mode].label}</span>
          </button>

          {/* Mode Dropdown */}
          <AnimatePresence>
            {showModeSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 z-50 bg-surface-2 border border-border-subtle rounded-xl shadow-lg p-2 min-w-[160px]"
              >
                {(Object.entries(MODE_CONFIG) as [ConversationMode, typeof MODE_CONFIG.text][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        onSwitchMode(key);
                        setShowModeSelector(false);
                      }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors text-left',
                        mode === key ? 'bg-neon-primary/20' : 'hover:bg-surface-3'
                      )}
                    >
                      <config.icon className={cn('h-4 w-4', config.color)} />
                      <div>
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-xs text-text-muted">{config.description}</p>
                      </div>
                    </button>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active Agent Badge */}
        {activeAgent && <AgentBadge agent={activeAgent as AgentType} isActive={isStreaming} />}

        {/* Agent Stack (shows hand-off history) */}
        {agentStack.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-text-muted">
            {agentStack.slice(-3).map((agent, i) => (
              <span key={`${agent}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-border-subtle">&rarr;</span>}
                <span className="capitalize">{agent}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* TTS Toggle (visible in voice/ambient mode) */}
        {(mode === 'voice' || mode === 'ambient') && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTTS}
            title={ttsEnabled ? 'Mute responses' : 'Unmute responses'}
            className="h-8 w-8"
          >
            {ttsEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-text-muted" />
            )}
          </Button>
        )}

        {/* Clear Button */}
        {messagesCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearMessages} className="text-xs h-7">
            Clear
          </Button>
        )}
      </div>
    </header>
  );
}
