'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePrivacyMode } from '@/lib/stores/financehub';
import { formatCurrency, formatCompactCurrency } from '@/types/finance';

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  compact?: boolean;
  showSign?: boolean;
  colorize?: boolean;
  animate?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

/**
 * AmountDisplay Component
 *
 * Displays a currency amount with optional:
 * - Privacy blur
 * - Color coding (green for positive, red for negative)
 * - Compact formatting ($1.2K, $3.5M)
 * - Animation on value change
 */
export function AmountDisplay({
  amount,
  currency = 'USD',
  compact = false,
  showSign = false,
  colorize = false,
  animate = false,
  size = 'md',
  className,
}: AmountDisplayProps) {
  const privacyMode = usePrivacyMode();

  const formattedAmount = compact
    ? formatCompactCurrency(amount, currency)
    : formatCurrency(amount, currency);

  const displayValue = showSign && amount > 0 ? `+${formattedAmount}` : formattedAmount;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl font-bold',
  };

  const colorClasses = colorize
    ? amount > 0
      ? 'text-green-400'
      : amount < 0
      ? 'text-red-400'
      : 'text-foreground'
    : '';

  const content = (
    <span
      className={cn(
        sizeClasses[size],
        colorClasses,
        privacyMode && 'blur-sm select-none hover:blur-[2px] transition-all',
        className
      )}
      data-privacy={privacyMode ? 'blur' : undefined}
    >
      {privacyMode ? '••••••' : displayValue}
    </span>
  );

  if (animate) {
    return (
      <motion.span
        key={amount}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-block"
      >
        {content}
      </motion.span>
    );
  }

  return content;
}

AmountDisplay.displayName = 'AmountDisplay';
