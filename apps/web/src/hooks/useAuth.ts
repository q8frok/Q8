'use client';

import { useSession } from '@/components/auth/SessionManager';

/**
 * Convenient auth hook with derived values
 *
 * Wraps useSession with additional computed properties for easier consumption
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, signOut, userId, userEmail } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <p>Please sign in</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome, {userEmail}</p>
 *       <button onClick={signOut}>Sign out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, signOut, refreshSession } = useSession();

  const isDevAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
  const devUserId = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || 'dev-user-q8';
  const devUserEmail = process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL || 'dev@q8.local';
  const devUserName = process.env.NEXT_PUBLIC_DEV_AUTH_NAME || 'Q8 Dev User';

  const effectiveUserId = user?.id || (isDevAuthBypass ? devUserId : undefined);
  const effectiveUserEmail = user?.email || (isDevAuthBypass ? devUserEmail : undefined);
  const effectiveFullName = user?.user_metadata?.full_name || (isDevAuthBypass ? devUserName : undefined);

  return {
    user,
    isLoading: isDevAuthBypass ? false : isLoading,
    isAuthenticated: isDevAuthBypass ? true : isAuthenticated,
    signOut,
    refreshSession,
    userId: effectiveUserId,
    userEmail: effectiveUserEmail,
    userRole: user?.user_metadata?.role,
    fullName: effectiveFullName,
    avatarUrl: user?.user_metadata?.avatar_url,
    isPro: user?.user_metadata?.is_pro,
  };
}
