import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';

/**
 * Supabase client for browser-side authentication and data operations
 *
 * Uses @supabase/ssr for proper cookie-based session handling
 * that works seamlessly with server-side auth callbacks.
 *
 * Features:
 * - Cookie-based session storage (syncs with server)
 * - Auto token refresh
 * - OAuth redirect handling
 */
export const supabase = createBrowserClient(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
