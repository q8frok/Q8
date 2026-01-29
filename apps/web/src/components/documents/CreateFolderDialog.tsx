'use client';

/**
 * CreateFolderDialog
 * Modal dialog for creating or renaming folders
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, FolderPlus, Loader2 } from 'lucide-react';

const FOLDER_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
];

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string | null) => Promise<void>;
  /** If provided, dialog is in rename mode */
  initialName?: string;
  initialColor?: string | null;
  mode?: 'create' | 'rename';
}

export function CreateFolderDialog({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialColor = null,
  mode = 'create',
}: CreateFolderDialogProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string | null>(initialColor);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
      setError(null);
      // Focus input after mount
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialName, initialColor]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Folder name is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed, color);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5">
              <FolderPlus className="w-5 h-5 text-white/80" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {mode === 'create' ? 'New Folder' : 'Rename Folder'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="space-y-4">
            {/* Name input */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">
                Folder name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name..."
                maxLength={255}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">
                Color (optional)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === null
                      ? 'border-white scale-110'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: '#374151' }}
                  title="Default"
                />
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-white/40'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateFolderDialog;
