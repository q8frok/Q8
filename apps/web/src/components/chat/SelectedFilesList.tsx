'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X, FileText } from 'lucide-react';

interface SelectedFilesListProps {
  selectedFiles: File[];
  onRemove: (index: number) => void;
  className?: string;
}

export function SelectedFilesList({ selectedFiles, onRemove, className }: SelectedFilesListProps) {
  if (selectedFiles.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 mb-2", className)}>
      {selectedFiles.map((file, index) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          key={`${file.name}-${index}`}
          className="bg-surface-3 border border-border-subtle px-3 py-2 rounded-lg flex items-center gap-2"
        >
          <FileText className="h-4 w-4 text-text-muted" />
          <span className="text-sm text-text-primary">{file.name}</span>
          <button
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.name}`}
            className="h-6 w-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors focus-ring rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}
