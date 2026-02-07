'use client';

/**
 * Knowledge Base Page
 * Full-page document management interface
 */

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { KnowledgeBase } from '@/components/documents';
import { CollapsibleHeader } from '@/components/shared/CollapsibleHeader';
import { useScrollCollapse } from '@/hooks/useScrollCollapse';
import { BookOpen } from 'lucide-react';

function KnowledgePageContent() {
  const { progress, scrollRef } = useScrollCollapse(80);

  return (
    <div className="min-h-screen relative">
      <div className="h-screen flex flex-col">
        <CollapsibleHeader
          title="Knowledge Base"
          progress={progress}
          backHref="/"
          icon={<BookOpen className="h-5 w-5 text-neon-primary" />}
          subtitle="Manage your documents and files"
        />
        <div ref={scrollRef} className="flex-1 overflow-hidden">
          <KnowledgeBase />
        </div>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <ProtectedRoute>
      <KnowledgePageContent />
    </ProtectedRoute>
  );
}
