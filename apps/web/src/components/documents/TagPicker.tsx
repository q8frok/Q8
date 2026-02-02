'use client';

/**
 * TagPicker
 * Dropdown for selecting/creating tags for documents
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tag, Plus, X, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { DocumentTag } from '@/lib/documents/types';

const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#06B6D4',
];

interface TagPickerProps {
  /** Currently assigned tag IDs */
  selectedTagIds: string[];
  /** Called when tags change */
  onChange: (tagIds: string[]) => void;
  /** Compact mode */
  compact?: boolean;
}

export function TagPicker({ selectedTagIds, onChange, compact = false }: TagPickerProps) {
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]!);
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch('/api/documents/tags');
        const data = await response.json();
        if (data.success) {
          setTags(data.tags);
        }
      } catch (error) {
        logger.error('Failed to fetch tags', { error });
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const toggleTag = useCallback((tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  }, [selectedTagIds, onChange]);

  const createTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/documents/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      const data = await response.json();
      if (data.success && data.tag) {
        setTags((prev) => [...prev, data.tag]);
        onChange([...selectedTagIds, data.tag.id]);
        setNewTagName('');
      }
    } catch (error) {
      logger.error('Failed to create tag', { error });
    } finally {
      setCreating(false);
    }
  }, [newTagName, newTagColor, selectedTagIds, onChange]);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected tags display */}
      <div
        className="flex flex-wrap gap-1 min-h-[32px] cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedTags.length === 0 ? (
          <span className="flex items-center gap-1 text-sm text-white/40 py-1">
            <Tag className="w-3.5 h-3.5" />
            {compact ? 'Tags' : 'Add tags...'}
          </span>
        ) : (
          selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
              style={{ backgroundColor: `${tag.color || '#6B7280'}33` }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color || '#6B7280' }}
              />
              {tag.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTag(tag.id);
                }}
                className="hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            </div>
          ) : (
            <>
              {tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      isSelected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || '#6B7280' }}
                    />
                    <span className="truncate flex-1 text-left">{tag.name}</span>
                    {isSelected && <span className="text-xs text-green-400">✓</span>}
                  </button>
                );
              })}

              {/* Create new tag */}
              <div className="border-t border-white/10 mt-1 pt-1 px-3 pb-2">
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createTag();
                      }
                    }}
                    placeholder="New tag..."
                    className="flex-1 px-2 py-1 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    maxLength={50}
                  />
                  <button
                    onClick={createTag}
                    disabled={creating || !newTagName.trim()}
                    className="p-1 rounded hover:bg-white/10 text-white/60 disabled:opacity-30"
                    aria-label="Create tag"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-5 h-5 rounded-full border transition-all ${
                        newTagColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TagPicker;
