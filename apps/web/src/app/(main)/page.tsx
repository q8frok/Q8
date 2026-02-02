'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Mic, Command, BookOpen, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BentoGrid, BentoItem } from '@/components/dashboard/BentoGrid';
import {
  StatusWidget,
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
import { DailyBriefWidget } from '@/components/dashboard/DailyBriefWidget';
import { UnifiedChatWithThreads, UnifiedChatWithThreadsRef } from '@/components/chat/UnifiedChatWithThreads';
import { UserProfile } from '@/components/auth/UserProfile';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { CommandPalette } from '@/components/CommandPalette';
import { SettingsPanel } from '@/components/settings';
import { ToastProvider, toast } from '@/components/ui/toast';
import { AnimatedBackground } from '@/components/shared/AnimatedBackground';
import { VoiceFAB } from '@/components/shared/VoiceFAB';
import { ChatProvider } from '@/contexts/ChatContext';
import { WidgetUpdateProvider } from '@/contexts/WidgetUpdateContext';
import { logger } from '@/lib/logger';


function DashboardContent() {
  // SECURITY: Get userId from authenticated session, not hardcoded
  const { userId, fullName, isLoading } = useAuth();
  const router = useRouter();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
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

  // Show loading state while auth is being verified
  if (isLoading || !userId) {
    return null; // ProtectedRoute handles loading state
  }

  return (
    <main className="min-h-screen relative">
      {/* Animated Background */}
      <AnimatedBackground />

      <div className="container mx-auto py-4 md:py-6 px-3 md:px-4 relative z-10 safe-area-container">
        {/* Header */}
        <header className="mb-4 md:mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              Q8
            </h1>
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

            {/* Knowledge Base Button */}
            <Link
              href="/knowledge"
              className="flex items-center gap-2 p-2.5 sm:px-3 sm:py-2 rounded-xl bg-surface-3 hover:bg-surface-2 transition-colors border border-border-subtle"
              title="Knowledge Base"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Knowledge</span>
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

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl hover:bg-surface-3 transition-colors"
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
              {/* Daily Brief - Summary with calendar, weather, tasks, quick actions, insights */}
              <BentoItem colSpan={2} rowSpan={2}>
                <DailyBriefWidget userId={userId} />
              </BentoItem>

              {/* Time Hub - World Clocks, Timer, Stopwatch, Alarms */}
              <BentoItem colSpan={2} rowSpan={2}>
                <ClockWidget colSpan={2} rowSpan={2} />
              </BentoItem>

              {/* Weather Widget - Enhanced with forecast */}
              <BentoItem colSpan={2} rowSpan={2}>
                <WeatherWidget
                  location="New York"
                  unit="fahrenheit"
                  showForecast={true}
                />
              </BentoItem>

              {/* Task Widget */}
              <BentoItem colSpan={2} rowSpan={2}>
                <TaskWidget />
              </BentoItem>

              {/* Calendar Widget */}
              <BentoItem colSpan={2} rowSpan={1}>
                <CalendarWidget maxItems={3} />
              </BentoItem>

              {/* Quick Notes */}
              <BentoItem colSpan={2} rowSpan={2}>
                <QuickNotesWidget userId={userId} />
              </BentoItem>

              {/* ContentHub Widget - Unified Media Hub */}
              <BentoItem colSpan={2} rowSpan={2}>
                <ContentHubWidget />
              </BentoItem>

              {/* GitHub PR Widget */}
              <BentoItem colSpan={2} rowSpan={2}>
                <GitHubPRWidget maxItems={5} />
              </BentoItem>

              {/* Smart Home Widget */}
              <BentoItem colSpan={2} rowSpan={3}>
                <SmartHomeWidget />
              </BentoItem>

              {/* Finance Hub Widget */}
              <BentoItem colSpan={2} rowSpan={2}>
                <FinanceHubWidget />
              </BentoItem>
            </BentoGrid>
          </div>

          {/* Right Column - Chat Interface (hidden on mobile, shown as overlay) */}
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

      {/* Mobile Chat Overlay */}
      {showMobileChat && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileChat(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col bg-[var(--surface-1)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-base font-semibold">Chat</h2>
              <button
                onClick={() => setShowMobileChat(false)}
                className="p-2 rounded-xl hover:bg-surface-3 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
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
      )}

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
        onPreferencesChange={(prefs) => {
          toast.success('Settings saved', 'Your preferences have been updated');
        }}
      />

      {/* Mobile Voice FAB */}
      <VoiceFAB
        onVoice={() => chatRef.current?.switchMode('voice')}
        onSettings={() => setIsSettingsOpen(true)}
        onKnowledge={() => router.push('/knowledge')}
        onChat={() => setShowMobileChat(true)}
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
