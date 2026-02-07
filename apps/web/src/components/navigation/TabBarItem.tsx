'use client';

import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/animations/springs';
import { haptics } from '@/lib/pwa/haptics';

interface TabBarItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function TabBarItem({ icon: Icon, label, isActive, onClick }: TabBarItemProps) {
  const handleClick = () => {
    haptics.selection();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center justify-center flex-1 gap-0.5 py-1',
        'transition-colors',
        isActive ? 'text-neon-primary' : 'text-text-muted'
      )}
      aria-label={label}
    >
      {isActive && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute -top-1 w-5 h-0.5 rounded-full bg-neon-primary"
          transition={springSnappy}
        />
      )}
      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={springSnappy}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
      </motion.div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
