import { springDefault } from './springs';

/**
 * Staggered entrance animation for widget grids.
 * Each item delays by 40ms, capped at 300ms total.
 */
export function staggerChildren(index: number) {
  const delay = Math.min(index * 0.04, 0.3);
  return {
    initial: { opacity: 0, y: 20, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { ...springDefault, delay },
  };
}

/**
 * Container variants for orchestrating staggered children.
 */
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/**
 * Child variants for use with staggerContainer.
 */
export const staggerItem = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};
