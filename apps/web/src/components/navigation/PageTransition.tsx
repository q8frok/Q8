'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useNavigationStore, type NavigationDirection } from '@/lib/stores/navigation';
import { springGentle } from '@/lib/animations/springs';

interface PageTransitionProps {
  children: ReactNode;
}

function getVariants(direction: NavigationDirection) {
  if (direction === 'tab') {
    // Cross-dissolve for tab switches
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  if (direction === 'pop') {
    // Slide from left (back navigation)
    return {
      initial: { opacity: 0, x: -80 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 80 },
    };
  }
  // Push: slide from right
  return {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  };
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const direction = useNavigationStore((s) => s.direction);
  const variants = getVariants(direction);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={springGentle}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
