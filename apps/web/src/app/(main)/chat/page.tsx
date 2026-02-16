'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

const UnifiedChatWithThreads = dynamic(
  () => import('@/components/chat/UnifiedChatWithThreads').then((m) => m.UnifiedChatWithThreads),
  { ssr: false }
);

function ChatWorkspaceContent() {
  const { userId, fullName, isLoading } = useAuth();

  if (isLoading || !userId) return null;

  return (
    <main className="h-screen p-3 md:p-4">
      <div className="h-full surface-matte rounded-2xl overflow-hidden">
        <UnifiedChatWithThreads
          userId={userId}
          userProfile={{
            name: fullName || 'User',
            timezone: 'America/New_York',
            communicationStyle: 'concise',
          }}
          defaultMode="text"
          showInspector={true}
        />
      </div>
    </main>
  );
}

export default function ChatWorkspacePage() {
  return (
    <ProtectedRoute>
      <ChatWorkspaceContent />
    </ProtectedRoute>
  );
}
