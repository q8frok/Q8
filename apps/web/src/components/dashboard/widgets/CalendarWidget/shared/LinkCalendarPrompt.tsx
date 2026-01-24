'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Link, ExternalLink, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LinkCalendarPromptProps } from '../types';

/**
 * LinkCalendarPrompt - Empty state prompting OAuth connection
 *
 * Displayed when user hasn't connected their Google Calendar.
 */
export const LinkCalendarPrompt = memo(function LinkCalendarPrompt({
  onLink,
  isLinking = false,
}: LinkCalendarPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-6 px-4 text-center"
    >
      {/* Icon */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-neon-primary/10 flex items-center justify-center">
          <Calendar className="h-8 w-8 text-neon-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-2 border-2 border-neon-primary flex items-center justify-center">
          <Link className="h-3 w-3 text-neon-primary" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary mb-1">
        Connect Google Calendar
      </h3>

      {/* Description */}
      <p className="text-sm text-text-muted mb-4 max-w-[240px]">
        Link your Google Calendar to view events, create new ones, and stay organized.
      </p>

      {/* Features List */}
      <div className="text-left space-y-1.5 mb-5 w-full max-w-[200px]">
        {[
          'View all your calendars',
          'Create & edit events',
          'Join meetings with one click',
          'Real-time sync',
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
            <div className="w-1 h-1 rounded-full bg-neon-primary" />
            {feature}
          </div>
        ))}
      </div>

      {/* Link Button */}
      <Button
        variant="default"
        onClick={onLink}
        disabled={isLinking}
        className="w-full max-w-[200px] bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary"
      >
        {isLinking ? (
          <>
            <div className="h-4 w-4 border-2 border-neon-primary/50 border-t-neon-primary rounded-full animate-spin mr-2" />
            Connecting...
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4 mr-2" />
            Link Google Calendar
          </>
        )}
      </Button>

      {/* Privacy Note */}
      <div className="flex items-center gap-1.5 mt-4 text-[10px] text-text-muted">
        <Shield className="h-3 w-3" />
        <span>Secure OAuth connection</span>
      </div>
    </motion.div>
  );
});

LinkCalendarPrompt.displayName = 'LinkCalendarPrompt';

export default LinkCalendarPrompt;
