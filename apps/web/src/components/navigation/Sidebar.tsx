'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, BookOpen, Settings, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/animations/springs';
import { useNavigationStore } from '@/lib/stores/navigation';

const NAV_ITEMS = [
  { id: 'home', href: '/', icon: Home, label: 'Home' },
  { id: 'knowledge', href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
  { id: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
  { id: 'admin', href: '/admin', icon: Activity, label: 'Admin' },
] as const;

/**
 * Desktop-only collapsible sidebar. Visible at xl+ breakpoint.
 * 56px collapsed, 240px expanded.
 */
export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const setDirection = useNavigationStore((s) => s.setDirection);

  const handleNav = (href: string) => {
    if (href !== pathname) {
      setDirection('push');
      router.push(href);
    }
  };

  return (
    <motion.nav
      initial={false}
      animate={{ width: expanded ? 240 : 56 }}
      transition={springSnappy}
      className="hidden xl:flex flex-col fixed left-0 top-0 bottom-0 z-30 border-r border-border-subtle"
      style={{
        backgroundColor: 'oklch(14% 0.012 260 / 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-border-subtle">
        <span className="text-lg font-bold text-neon-primary">Q8</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 p-2 pt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.href)}
              className={cn(
                'relative flex items-center gap-3 h-10 rounded-lg transition-colors',
                expanded ? 'px-3' : 'justify-center',
                isActive
                  ? 'text-neon-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-3'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-0 rounded-lg bg-neon-primary/10 border border-neon-primary/20"
                  transition={springSnappy}
                />
              )}
              <Icon className="relative h-5 w-5 shrink-0" />
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="h-10 flex items-center justify-center border-t border-border-subtle text-text-muted hover:text-text-primary transition-colors"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    </motion.nav>
  );
}
