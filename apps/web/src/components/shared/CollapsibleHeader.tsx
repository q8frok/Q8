'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface CollapsibleHeaderProps {
  /** Large title displayed when expanded */
  title: string;
  /** Collapse progress 0 (expanded) to 1 (collapsed) */
  progress: number;
  /** Optional icon before the title */
  icon?: ReactNode;
  /** Back navigation href. If provided, shows a back arrow. */
  backHref?: string;
  /** Right-side action buttons */
  trailing?: ReactNode;
  /** Subtitle below the large title (only visible when expanded) */
  subtitle?: string;
  /** Content between title and page body (e.g. ModeSelector, search bar) */
  children?: ReactNode;
}

/**
 * iOS-style collapsible large title header.
 * Large title (34px bold) collapses into compact inline (17px centered)
 * with blur backdrop as user scrolls.
 */
export function CollapsibleHeader({
  title,
  progress,
  icon,
  backHref,
  trailing,
  subtitle,
  children,
}: CollapsibleHeaderProps) {
  // Interpolated values
  const largeTitleOpacity = 1 - Math.min(progress * 2, 1); // fades out in first 50%
  const compactOpacity = Math.max((progress - 0.3) / 0.7, 0); // fades in from 30%
  const largeTitleScale = 1 - progress * 0.15; // 1 -> 0.85
  const headerBlur = progress * 20; // 0 -> 20px

  return (
    <header className="sticky top-0 z-30">
      {/* Compact header (always rendered, fades in) */}
      <div
        className="flex items-center justify-between h-11 px-4"
        style={{
          backdropFilter: `blur(${headerBlur}px)`,
          WebkitBackdropFilter: `blur(${headerBlur}px)`,
          backgroundColor: `oklch(16% 0.015 260 / ${progress * 0.7})`,
          borderBottom: progress > 0.1 ? `0.5px solid oklch(100% 0 0 / ${progress * 0.08})` : 'none',
        }}
      >
        {/* Left: back arrow */}
        <div className="w-20 flex items-center">
          {backHref && (
            <Link
              href={backHref}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-3 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Center: compact title */}
        <motion.span
          className="text-[17px] font-semibold text-text-primary truncate"
          style={{ opacity: compactOpacity }}
        >
          {title}
        </motion.span>

        {/* Right: trailing actions */}
        <div className="w-20 flex items-center justify-end gap-2">
          {trailing}
        </div>
      </div>

      {/* Large title area (collapses) */}
      <div
        className="px-4 pb-2"
        style={{
          opacity: largeTitleOpacity,
          transform: `scale(${largeTitleScale})`,
          transformOrigin: 'left center',
          pointerEvents: progress > 0.8 ? 'none' : 'auto',
          height: progress > 0.95 ? 0 : 'auto',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <h1 className="text-[34px] font-bold text-text-primary tracking-[-0.022em] leading-tight">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5 ml-0.5">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </header>
  );
}
