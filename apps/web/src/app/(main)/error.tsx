'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-white/60">
            {error.message || 'An unexpected error occurred while loading the dashboard.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={reset}
            variant="subtle"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="ghost"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
