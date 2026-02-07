'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Command, MessageCircle, LayoutGrid, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BentoGrid, BentoItem } from '@/components/dashboard/BentoGrid';
import { ModeSelector } from '@/components/dashboard/ModeSelector';
import { CollapsibleHeader } from '@/components/shared/CollapsibleHeader';
import { TabBar } from '@/components/navigation/TabBar';
import { useScrollCollapse } from '@/hooks/useScrollCollapse';
import { useAdaptiveMode } from '@/hooks/useAdaptiveMode';
import { useVisibleWidgets, useWidgetOrder } from '@/lib/stores/dashboard';
// Light widgets - static imports (small bundle impact)
import {
  WeatherWidget,
  TaskWidget,
  ClockWidget,
  QuickNotesWidget,
  WidgetSkeleton,
} from '@/components/dashboard/widgets';
// Heavy widgets - dynamic imports (code splitting)
const CalendarWidget = dynamic(
  () => import('@/components/dashboard/widgets/CalendarWidget/index').then(m => m.CalendarWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-1" />, ssr: false }
);
const FinanceHubWidget = dynamic(
  () => import('@/components/dashboard/widgets/FinanceHubWidget').then(m => m.FinanceHubWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-2" />, ssr: false }
);
const ContentHubWidget = dynamic(
  () => import('@/components/dashboard/widgets/ContentHubWidget').then(m => m.ContentHubWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-2" />, ssr: false }
);
const SmartHomeWidget = dynamic(
  () => import('@/components/dashboard/widgets/SmartHomeWidget/index').then(m => m.SmartHomeWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-3" />, ssr: false }
);
const GitHubPRWidget = dynamic(
  () => import('@/components/dashboard/widgets/GitHubPRWidget').then(m => m.GitHubPRWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-2" />, ssr: false }
);
const DailyBriefWidget = dynamic(
  () => import('@/components/dashboard/widgets/DailyBriefWidget').then(m => m.DailyBriefWidget),
  { loading: () => <WidgetSkeleton className="col-span-2 row-span-2" />, ssr: false }
);
// Heavy chat component - dynamic import
const UnifiedChatWithThreads = dynamic(
  () => import('@/components/chat/UnifiedChatWithThreads').then(m => m.UnifiedChatWithThreads),
  { ssr: false }
);
import type { UnifiedChatWithThreadsRef } from '@/components/chat/UnifiedChatWithThreads';
import { UserProfile } from '@/components/auth/UserProfile';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { CommandPalette } from '@/components/CommandPalette';
import { ToastProvider } from '@/components/ui/toast';
import { BottomSheet, type SnapPoint } from '@/components/ui/BottomSheet';
import { ChatProvider } from '@/contexts/ChatContext';
import { WidgetUpdateProvider } from '@/contexts/WidgetUpdateContext';
import { haptics } from '@/lib/pwa/haptics';


function DashboardContent() {
  // SECURITY: Get userId from authenticated session, not hardcoded
  const { userId, fullName, isLoading } = useAuth();
  const router = useRouter();

  const visibleWidgets = useVisibleWidgets();
  const widgetOrder = useWidgetOrder();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [chatSheetSnap, setChatSheetSnap] = useState<SnapPoint>('closed');
  const chatRef = useRef<UnifiedChatWithThreadsRef>(null);
  const adaptiveMode = useAdaptiveMode();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Cmd+. or Ctrl+. for settings - navigate to settings page
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        router.push('/settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Handle sending messages from command palette
  const handleSendMessage = (message: string) => {
    if (chatRef.current) {
      chatRef.current.sendMessage(message);
    }
  };

  // Open chat sheet to half state
  const openMobileChat = useCallback(() => {
    haptics.light();
    setChatSheetSnap('half');
  }, []);

  const { progress, scrollRef } = useScrollCollapse(80);

  // Show loading state while auth is being verified
  if (isLoading || !userId) {
    return null; // ProtectedRoute handles loading state
  }

  return (
    <main className="min-h-screen relative">
      <div className="safe-area-container">
        {/* iOS Collapsible Header */}
        <CollapsibleHeader
          title="Q8"
          progress={progress}
          trailing={
            <div className="flex items-center gap-2">
              {/* Command Palette Button - Hidden on mobile */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-3 hover:bg-surface-2 transition-colors border border-border-subtle"
                title="Command Palette (⌘K)"
              >
                <Command className="h-4 w-4" />
                <span className="text-sm">⌘K</span>
              </button>
              <UserProfile />
            </div>
          }
        >
          <ModeSelector />
        </CollapsibleHeader>

        <div ref={scrollRef} className="overflow-y-auto" style={{ height: 'calc(var(--vh, 1vh) * 100 - 49px)' }}>
        <div className="container mx-auto px-3 md:px-4">

        {/* Adaptive mode suggestion toast */}
        <AnimatePresence>
          {adaptiveMode && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-2 border border-border-subtle"
            >
              <span className="text-sm text-text-secondary flex-1">{adaptiveMode.label}</span>
              <button
                onClick={adaptiveMode.accept}
                className="text-xs font-medium text-neon-primary px-3 py-1.5 rounded-lg bg-neon-primary/10 hover:bg-neon-primary/20 transition-colors"
              >
                Switch
              </button>
              <button
                onClick={adaptiveMode.dismiss}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Dashboard Widgets */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <BentoGrid>
              <AnimatePresence mode="popLayout">
                {widgetOrder
                  .filter((id) => visibleWidgets.includes(id))
                  .map((widgetId, idx) => {
                    switch (widgetId) {
                      case 'daily-brief':
                        return (
                          <BentoItem key="daily-brief" id="daily-brief" colSpan={2} rowSpan={2} index={idx}>
                            <DailyBriefWidget userId={userId} />
                          </BentoItem>
                        );
                      case 'clock':
                        return (
                          <BentoItem key="clock" id="clock" colSpan={2} rowSpan={2} index={idx}>
                            <ClockWidget colSpan={2} rowSpan={2} />
                          </BentoItem>
                        );
                      case 'weather':
                        return (
                          <BentoItem key="weather" id="weather" colSpan={2} rowSpan={2} index={idx}>
                            <WeatherWidget location="New York" unit="fahrenheit" showForecast={true} />
                          </BentoItem>
                        );
                      case 'tasks':
                        return (
                          <BentoItem key="tasks" id="tasks" colSpan={2} rowSpan={2} index={idx}>
                            <TaskWidget />
                          </BentoItem>
                        );
                      case 'calendar':
                        return (
                          <BentoItem key="calendar" id="calendar" colSpan={2} rowSpan={1} index={idx}>
                            <CalendarWidget maxItems={3} />
                          </BentoItem>
                        );
                      case 'quick-notes':
                        return (
                          <BentoItem key="quick-notes" id="quick-notes" colSpan={2} rowSpan={2} index={idx}>
                            <QuickNotesWidget userId={userId} />
                          </BentoItem>
                        );
                      case 'content-hub':
                        return (
                          <BentoItem key="content-hub" id="content-hub" colSpan={2} rowSpan={2} index={idx}>
                            <ContentHubWidget />
                          </BentoItem>
                        );
                      case 'github':
                        return (
                          <BentoItem key="github" id="github" colSpan={2} rowSpan={2} index={idx}>
                            <GitHubPRWidget maxItems={5} />
                          </BentoItem>
                        );
                      case 'home':
                        return (
                          <BentoItem key="home" id="home" colSpan={2} rowSpan={3} index={idx}>
                            <SmartHomeWidget />
                          </BentoItem>
                        );
                      case 'finance':
                        return (
                          <BentoItem key="finance" id="finance" colSpan={2} rowSpan={2} index={idx}>
                            <FinanceHubWidget />
                          </BentoItem>
                        );
                      default:
                        return null;
                    }
                  })}
              </AnimatePresence>

              {visibleWidgets.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                  <LayoutGrid className="h-12 w-12 text-text-muted/50 mb-4" />
                  <p className="text-text-muted text-sm mb-1">No widgets visible</p>
                  <p className="text-text-muted/60 text-xs">
                    Switch to a mode or toggle widgets in Settings
                  </p>
                </div>
              )}
            </BentoGrid>
          </div>

          {/* Right Column - Chat Interface (hidden on mobile, shown as bottom sheet) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="lg:sticky lg:top-6 surface-matte rounded-2xl h-[calc(var(--vh,1vh)*100-12rem)] overflow-hidden">
              <UnifiedChatWithThreads
                ref={chatRef}
                userId={userId}
                userProfile={{
                  name: fullName || 'User',
                  timezone: 'America/New_York',
                  communicationStyle: 'concise',
                }}
                defaultMode="text"
              />
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Mobile Chat Bottom Sheet */}
      <BottomSheet
        snap={chatSheetSnap}
        onSnapChange={setChatSheetSnap}
        peekHeight={120}
        peekContent={
          <button
            onClick={() => setChatSheetSnap('half')}
            className="w-full flex items-center gap-3 px-2 py-2 text-left"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MessageCircle className="h-4 w-4 text-neon-primary shrink-0" />
              <span className="text-sm text-text-secondary truncate">
                Tap to open chat...
              </span>
            </div>
            <div className="shrink-0 px-3 py-1.5 rounded-full bg-neon-primary/20 text-xs font-medium text-neon-primary">
              Chat
            </div>
          </button>
        }
      >
        <UnifiedChatWithThreads
          ref={chatRef}
          userId={userId}
          userProfile={{
            name: fullName || 'User',
            timezone: 'America/New_York',
            communicationStyle: 'concise',
          }}
          defaultMode="text"
        />
      </BottomSheet>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSendMessage={handleSendMessage}
        onOpenSettings={() => router.push('/settings')}
        onOpenVoice={() => chatRef.current?.switchMode('voice')}
      />

      {/* Mobile Tab Bar */}
      <TabBar
        onChatTap={openMobileChat}
        onVoiceTap={() => chatRef.current?.switchMode('voice')}
      />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <ChatProvider>
        <WidgetUpdateProvider>
          <ProtectedRoute>
            <DashboardContent />
          </ProtectedRoute>
        </WidgetUpdateProvider>
      </ChatProvider>
    </ToastProvider>
  );
}
