'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { springBouncy } from '@/lib/animations/springs';
import { haptics } from '@/lib/pwa/haptics';
import { type LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

/**
 * iOS-style translucent context menu.
 * Rendered via portal, positioned at touch/click point.
 */
export function ContextMenu({ isOpen, x, y, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw - 8) {
      menuRef.current.style.left = `${vw - rect.width - 8}px`;
    }
    if (rect.bottom > vh - 8) {
      menuRef.current.style.top = `${vh - rect.height - 8}px`;
    }
  }, [isOpen, x, y]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from the same event
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('touchstart', handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [isOpen, onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Invisible backdrop for click-outside */}
          <div className="fixed inset-0 z-[9998]" onClick={onClose} />

          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springBouncy}
            className="fixed z-[9999] min-w-[180px] py-1.5 rounded-xl overflow-hidden"
            style={{
              left: x,
              top: y,
              backgroundColor: 'oklch(20% 0.015 260 / 0.85)',
              backdropFilter: 'blur(50px)',
              WebkitBackdropFilter: 'blur(50px)',
              border: '0.5px solid oklch(100% 0 0 / 0.1)',
              boxShadow: '0 8px 30px oklch(0% 0 0 / 0.3)',
              transformOrigin: 'top left',
            }}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={() => {
                    haptics.selection();
                    item.onClick();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 h-11 text-sm transition-colors hover:bg-white/10 active:bg-white/15"
                  style={{
                    color: item.destructive ? 'oklch(60% 0.25 25)' : 'oklch(98% 0 0)',
                  }}
                >
                  {Icon && <Icon className="h-4 w-4 opacity-70" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
