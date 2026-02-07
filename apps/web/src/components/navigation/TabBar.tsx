'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, MessageCircle, Mic, Settings } from 'lucide-react';
import { TabBarItem } from './TabBarItem';
import { useNavigationStore } from '@/lib/stores/navigation';

interface TabBarProps {
  /** Called when Chat tab is tapped (opens bottom sheet instead of navigating) */
  onChatTap?: () => void;
  /** Called when Voice tab is tapped (activates voice mode) */
  onVoiceTap?: () => void;
  /** Whether the keyboard is visible (hides tab bar) */
  isKeyboardVisible?: boolean;
}

const TABS = [
  { id: 'home', href: '/', icon: Home, label: 'Home' },
  { id: 'knowledge', href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
  { id: 'chat', href: null, icon: MessageCircle, label: 'Chat' },
  { id: 'voice', href: null, icon: Mic, label: 'Voice' },
  { id: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
] as const;

export function TabBar({ onChatTap, onVoiceTap, isKeyboardVisible }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const setDirection = useNavigationStore((s) => s.setDirection);

  const getActiveTab = useCallback(() => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/knowledge')) return 'knowledge';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'home';
  }, [pathname]);

  const activeTab = getActiveTab();

  const handleTabPress = useCallback(
    (tab: typeof TABS[number]) => {
      if (tab.id === 'chat') {
        onChatTap?.();
        return;
      }
      if (tab.id === 'voice') {
        onVoiceTap?.();
        return;
      }
      if (tab.href && tab.href !== pathname) {
        setDirection('tab');
        router.push(tab.href);
      }
    },
    [pathname, router, setDirection, onChatTap, onVoiceTap]
  );

  if (isKeyboardVisible) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: 'oklch(16% 0.015 260 / 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid oklch(100% 0 0 / 0.08)',
      }}
    >
      <div className="flex items-center h-[49px]">
        {TABS.map((tab) => (
          <TabBarItem
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            isActive={tab.id === activeTab}
            onClick={() => handleTabPress(tab)}
          />
        ))}
      </div>
    </nav>
  );
}
