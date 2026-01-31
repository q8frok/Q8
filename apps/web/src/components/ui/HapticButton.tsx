'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';

export interface HapticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ 
    className, 
    hapticFeedback = 'light', 
    variant = 'default',
    size = 'md',
    onClick,
    children,
    ...props 
  }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      haptics[hapticFeedback]?.();
      onClick?.(e);
    };

    const variants = {
      default: 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10',
      primary: 'bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary border border-neon-primary/30',
      secondary: 'bg-surface-3 hover:bg-surface-4 text-white/80 border border-border-subtle',
      ghost: 'hover:bg-white/5 text-white/60 hover:text-white/80',
      danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
    };

    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-neon-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

HapticButton.displayName = 'HapticButton';
