'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SECTION_VARIANTS } from '../constants';
import type { CollapsibleSectionProps } from '../types';

export function CollapsibleSection({
  icon,
  title,
  badge,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border-t border-white/5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-white/90">{title}</span>
          {badge && (
            <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={SECTION_VARIANTS.initial}
            animate={SECTION_VARIANTS.animate}
            exit={SECTION_VARIANTS.exit}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
