'use client';

/**
 * ContextMenu
 * Portal-based, viewport-aware context menu with keyboard navigation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!position || !menuRef.current) {
      setAdjustedPos(position);
      return;
    }

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const padding = 8;

    let { x, y } = position;

    // Flip horizontally if near right edge
    if (x + rect.width + padding > window.innerWidth) {
      x = Math.max(padding, x - rect.width);
    }

    // Flip vertically if near bottom edge
    if (y + rect.height + padding > window.innerHeight) {
      y = Math.max(padding, y - rect.height);
    }

    setAdjustedPos({ x, y });
  }, [position]);

  // Close on Escape, navigate with arrows
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex((prev) => {
            const next = prev + 1;
            return next >= items.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? items.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < items.length) {
            const item = items[focusIndex];
            if (item && !item.disabled) {
              item.onClick();
              onClose();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [position, items, focusIndex, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!position) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from the triggering right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [position, onClose]);

  if (!position) return null;

  const style: React.CSSProperties = adjustedPos
    ? { left: adjustedPos.x, top: adjustedPos.y }
    : { left: position.x, top: position.y, visibility: 'hidden' as const };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[9999] w-48 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={style}
    >
      {items.map((item, index) => (
        <button
          key={index}
          role="menuitem"
          disabled={item.disabled}
          tabIndex={focusIndex === index ? 0 : -1}
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              onClose();
            }
          }}
          className={`
            w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors outline-none
            ${item.variant === 'danger'
              ? 'text-red-400 hover:bg-red-400/10 focus:bg-red-400/10'
              : 'text-white/80 hover:bg-white/10 focus:bg-white/10'
            }
            ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}
            ${focusIndex === index ? (item.variant === 'danger' ? 'bg-red-400/10' : 'bg-white/10') : ''}
          `}
        >
          {item.icon && <span className="w-3.5 h-3.5 shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

/**
 * Hook to manage context menu state
 */
export function useContextMenu() {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuPos(null);
  }, []);

  return { menuPos, handleContextMenu, closeMenu };
}

export default ContextMenu;
