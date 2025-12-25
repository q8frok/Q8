'use client';

import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFinanceHubStore, usePrivacyMode } from '@/lib/stores/financehub';

interface PrivacyToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PrivacyToggle Component
 *
 * Toggle button to blur/show sensitive financial information.
 * When privacy mode is ON, all elements with data-privacy="blur" will be blurred.
 */
export function PrivacyToggle({ className, size = 'md' }: PrivacyToggleProps) {
  const privacyMode = usePrivacyMode();
  const togglePrivacy = useFinanceHubStore((s) => s.togglePrivacy);

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-8 w-8',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(sizeClasses[size], className)}
      onClick={togglePrivacy}
      title={privacyMode ? 'Show values' : 'Hide values'}
    >
      {privacyMode ? (
        <EyeOff className={cn(iconSizes[size], 'text-white/60')} />
      ) : (
        <Eye className={cn(iconSizes[size], 'text-white/60')} />
      )}
    </Button>
  );
}

PrivacyToggle.displayName = 'PrivacyToggle';
