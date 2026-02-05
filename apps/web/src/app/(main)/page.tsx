'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Mic, Command, BookOpen, MessageCircle, LayoutGrid } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BentoGrid, BentoItem } from '@/components/dashboard/BentoGrid';
import { ModeSelector } from '@/components/dashboard/ModeSelector';
import { useVisibleWidgets } from '@/lib/stores/dashboard';
import {
  WeatherWidget,
  ContentHubWidget,
  GitHubPRWidget,
  TaskWidget,
  CalendarWidget,
  ClockWidget,
  QuickNotesWidget,
  SmartHomeWidget,
  FinanceHubWidget,
} from '@/components/dashboard/widgets';
import { DailyBriefWidget } from '@/components/dashboard/widgets/DailyBriefWidget';
import { UnifiedChatWithThreads, UnifiedChatWithThreadsRef } from '@/components/chat/UnifiedChatWithThreads';
import { UserProfile } from '@/components/auth/UserProfile';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { CommandPalette } from '@/components/CommandPalette';
import { SettingsPanel } from '@/components/settings';
import { ToastProvider, toast } from '@/components/ui/toast';
import { AnimatedBackground } from '@/components/shared/AnimatedBackground';
import { VoiceFAB } from '@/components/shared/VoiceFAB';
import { BottomSheet, type SnapPoint } from '@/components/ui/BottomSheet';
import { ChatProvider } from '@/contexts/ChatContext';
import { WidgetUpdateProvider } from '@/contexts/WidgetUpdateContext';
import { haptics } from '@/lib/pwa/haptics';


function DashboardContent() {
  // SECURITY: Get userId from authenticated session, not hardcoded
  const { userId, fullName, isLoading } = useAuth();
  const router = useRouter();

  const visibleWidgets = useVisibleWidgets();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatSheetSnap, setChatSheetSnap] = useState<SnapPoint>('closed');
  const chatRef = useRef<UnifiedChatWithThreadsRef>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Cmd+. or Ctrl+. for settings
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Show loading state while auth is being verified
  if (isLoading || !userId) {
    return null; // ProtectedRoute handles loading state
  }

  return (
    <main className="min-h-screen relative">
      {/* Animated Background */}
      <AnimatedBackground />

      <div className="container mx-auto py-4 md:py-6 px-3 md:px-4 relative z-10 safe-area-container">
        {/* Header - optimized for 440pt */}
        <header className="mb-4 md:mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              Q8
            </h1>
            <ModeSelector />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* Command Palette Button - Hidden on mobile */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-3 hover:bg-surface-2 transition-colors border border-border-subtle"
              title="Command Palette (⌘K)"
            >
              <Command className="h-4 w-4" />
              <span className="text-sm">⌘K</span>
            </button>

            {/* Knowledge Base Button - icon-only until md breakpoint */}
            <Link
              href="/knowledge"
              className="flex items-center gap-2 p-2.5 md:px-3 md:py-2 rounded-xl bg-surface-3 hover:bg-surface-2 transition-colors border border-border-subtle"
              title="Knowledge Base"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline text-sm">Knowledge</span>
            </Link>

            {/* Voice Mode Button - Hidden on mobile (available in FAB) */}
            <button
              onClick={() => chatRef.current?.switchMode('voice')}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-primary/20 hover:bg-neon-primary/30 transition-colors border border-neon-primary/30"
              title="Switch to Voice Mode"
            >
              <Mic className="h-4 w-4" />
              <span className="text-sm font-medium">Voice</span>
            </button>

            {/* Settings Button - hidden on mobile (available in FAB) */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex p-2.5 rounded-xl hover:bg-surface-3 transition-colors"
              title="Settings (⌘.)"
            >
              <Settings className="h-5 w-5" />
            </button>

            <UserProfile />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Dashboard Widgets */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <BentoGrid>
              <AnimatePresence mode="popLayout">
                {visibleWidgets.includes('daily-brief') && (
                  <BentoItem key="daily-brief" colSpan={2} rowSpan={2}>
                    <DailyBriefWidget userId={userId} />
                  </BentoItem>
                )}

                {visibleWidgets.includes('clock') && (
                  <BentoItem key="clock" colSpan={2} rowSpan={2}>
                    <ClockWidget colSpan={2} rowSpan={2} />
                  </BentoItem>
                )}

                {visibleWidgets.includes('weather') && (
                  <BentoItem key="weather" colSpan={2} rowSpan={2}>
                    <WeatherWidget
                      location="New York"
                      unit="fahrenheit"
                      showForecast={true}
                    />
                  </BentoItem>
                )}

                {visibleWidgets.includes('tasks') && (
                  <BentoItem key="tasks" colSpan={2} rowSpan={2}>
                    <TaskWidget />
                  </BentoItem>
                )}

                {visibleWidgets.includes('calendar') && (
                  <BentoItem key="calendar" colSpan={2} rowSpan={1}>
                    <CalendarWidget maxItems={3} />
                  </BentoItem>
                )}

                {visibleWidgets.includes('quick-notes') && (
                  <BentoItem key="quick-notes" colSpan={2} rowSpan={2}>
                    <QuickNotesWidget userId={userId} />
                  </BentoItem>
                )}

                {visibleWidgets.includes('content-hub') && (
                  <BentoItem key="content-hub" colSpan={2} rowSpan={2}>
                    <ContentHubWidget />
                  </BentoItem>
                )}

                {visibleWidgets.includes('github') && (
                  <BentoItem key="github" colSpan={2} rowSpan={2}>
                    <GitHubPRWidget maxItems={5} />
                  </BentoItem>
                )}

                {visibleWidgets.includes('home') && (
                  <BentoItem key="home" colSpan={2} rowSpan={3}>
                    <SmartHomeWidget />
                  </BentoItem>
                )}

                {visibleWidgets.includes('finance') && (
                  <BentoItem key="finance" colSpan={2} rowSpan={2}>
                    <FinanceHubWidget />
                  </BentoItem>
                )}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVoice={() => chatRef.current?.switchMode('voice')}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={userId}
        onPreferencesChange={(_prefs) => {
          toast.success('Settings saved', 'Your preferences have been updated');
        }}
      />

      {/* Mobile Voice FAB */}
      <VoiceFAB
        onVoice={() => chatRef.current?.switchMode('voice')}
        onSettings={() => setIsSettingsOpen(true)}
        onKnowledge={() => router.push('/knowledge')}
        onChat={openMobileChat}
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
