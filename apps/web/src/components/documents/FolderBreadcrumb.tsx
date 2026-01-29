'use client';

/**
 * FolderBreadcrumb
 * Clickable breadcrumb navigation for folder hierarchy
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
  parentId: string | null;
}

interface FolderBreadcrumbProps {
  breadcrumb: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function FolderBreadcrumb({ breadcrumb, onNavigate }: FolderBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-white/60 overflow-x-auto min-w-0">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 hover:text-white transition-colors shrink-0"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Root</span>
      </button>

      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/30" />
            {isLast ? (
              <span className="text-white font-medium truncate">{item.name}</span>
            ) : (
              <button
                onClick={() => onNavigate(item.id)}
                className="hover:text-white transition-colors truncate"
              >
                {item.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default FolderBreadcrumb;
