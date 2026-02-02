'use client';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn('surface-matte p-4 animate-pulse', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-white/10" />
        <div className="flex-1">
          <div className="h-5 w-40 bg-white/10 rounded mb-1" />
          <div className="h-3 w-28 bg-white/10 rounded" />
        </div>
      </div>
      <div className="h-4 w-full bg-white/10 rounded mb-2" />
      <div className="h-4 w-3/4 bg-white/10 rounded" />
    </div>
  );
}
