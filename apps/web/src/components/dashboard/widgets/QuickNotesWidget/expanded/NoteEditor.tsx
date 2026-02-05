'use client';

/**
 * NoteEditor Component
 * Rich text editor for notes using textarea (upgradable to Tiptap)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Code,
  Link,
  Quote,
  Minus,
  Sparkles,
  Loader2,
  ChevronDown,
  Undo2,
  FileText,
  Expand,
  PenLine,
  MessageSquare,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNoteAI, OPERATION_LABELS, type NoteAIOperation } from '@/hooks/useNoteAI';
import type { Note } from '@/lib/supabase/types';

interface NoteEditorProps {
  note: Note;
  onContentChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  autoFocus?: boolean;
}

interface ToolbarButton {
  icon: typeof Bold;
  label: string;
  action: () => void;
  shortcut?: string;
}

/**
 * Insert markdown syntax at cursor position
 */
function insertMarkdown(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string = '',
  placeholder: string = ''
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  const insertText = selectedText || placeholder;
  const newText =
    text.substring(0, start) +
    prefix +
    insertText +
    suffix +
    text.substring(end);

  // Return new text, cursor position will be set after
  return newText;
}

export function NoteEditor({
  note,
  onContentChange,
  onTitleChange,
  autoFocus = true,
}: NoteEditorProps) {
  const [content, setContent] = useState(note.content);
  const [title, setTitle] = useState(note.title || '');
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [contentBeforeAI, setContentBeforeAI] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isProcessing, processNote, lastError } = useNoteAI();

  // Update local state when note changes
  useEffect(() => {
    setContent(note.content);
    setTitle(note.title || '');
  }, [note.id, note.content, note.title]);

  // Close AI menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setShowAIMenu(false);
      }
    };
    if (showAIMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showAIMenu]);

  // Auto-save with debounce
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setIsSaving(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        onContentChange(newContent);
        setIsSaving(false);
      }, 500);
    },
    [onContentChange]
  );

  // AI assist handler
  const handleAIOperation = useCallback(
    async (operation: NoteAIOperation) => {
      setShowAIMenu(false);
      setContentBeforeAI(content);
      const result = await processNote(content, operation);
      if (result) {
        handleContentChange(result);
      }
    },
    [content, processNote, handleContentChange]
  );

  const handleUndoAI = useCallback(() => {
    if (contentBeforeAI !== null) {
      handleContentChange(contentBeforeAI);
      setContentBeforeAI(null);
    }
  }, [contentBeforeAI, handleContentChange]);

  // Calculate word count
  useEffect(() => {
    const words = content.split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [content]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      onTitleChange(newTitle);
    },
    [onTitleChange]
  );

  // Toolbar actions
  const insertHeading1 = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '# ', '', 'Heading');
    handleContentChange(newContent);
  };

  const insertHeading2 = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '## ', '', 'Heading');
    handleContentChange(newContent);
  };

  const insertBold = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '**', '**', 'bold text');
    handleContentChange(newContent);
  };

  const insertItalic = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '*', '*', 'italic text');
    handleContentChange(newContent);
  };

  const insertBulletList = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '\n- ', '', 'item');
    handleContentChange(newContent);
  };

  const insertNumberedList = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '\n1. ', '', 'item');
    handleContentChange(newContent);
  };

  const insertChecklist = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '\n- [ ] ', '', 'task');
    handleContentChange(newContent);
  };

  const insertCode = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '`', '`', 'code');
    handleContentChange(newContent);
  };

  const insertQuote = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '\n> ', '', 'quote');
    handleContentChange(newContent);
  };

  const insertDivider = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const text = textareaRef.current.value;
    const newContent = text.substring(0, start) + '\n---\n' + text.substring(start);
    handleContentChange(newContent);
  };

  const insertLink = () => {
    if (!textareaRef.current) return;
    const newContent = insertMarkdown(textareaRef.current, '[', '](url)', 'link text');
    handleContentChange(newContent);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertBold();
          break;
        case 'i':
          e.preventDefault();
          insertItalic();
          break;
        case 'k':
          e.preventDefault();
          insertLink();
          break;
      }
    }

    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const text = content;
      const newContent = text.substring(0, start) + '  ' + text.substring(start);
      handleContentChange(newContent);
      
      // Set cursor position after the tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const toolbarButtons: ToolbarButton[] = [
    { icon: Heading1, label: 'Heading 1', action: insertHeading1, shortcut: undefined },
    { icon: Heading2, label: 'Heading 2', action: insertHeading2, shortcut: undefined },
    { icon: Bold, label: 'Bold', action: insertBold, shortcut: '⌘B' },
    { icon: Italic, label: 'Italic', action: insertItalic, shortcut: '⌘I' },
    { icon: List, label: 'Bullet List', action: insertBulletList, shortcut: undefined },
    { icon: ListOrdered, label: 'Numbered List', action: insertNumberedList, shortcut: undefined },
    { icon: CheckSquare, label: 'Checklist', action: insertChecklist, shortcut: undefined },
    { icon: Code, label: 'Code', action: insertCode, shortcut: undefined },
    { icon: Quote, label: 'Quote', action: insertQuote, shortcut: undefined },
    { icon: Link, label: 'Link', action: insertLink, shortcut: '⌘K' },
    { icon: Minus, label: 'Divider', action: insertDivider, shortcut: undefined },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-white/5">
        {toolbarButtons.map((button, index) => (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={button.action}
            title={button.shortcut ? `${button.label} (${button.shortcut})` : button.label}
          >
            <button.icon className="h-4 w-4" />
          </Button>
        ))}
        
        <div className="h-6 w-px bg-white/20 mx-2" />
        
        {/* AI Tools */}
        <div className="relative" ref={aiMenuRef}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-neon-primary"
            onClick={() => setShowAIMenu(!showAIMenu)}
            disabled={isProcessing || !content.trim()}
            title="AI Assist"
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">AI</span>
            <ChevronDown className="h-3 w-3" />
          </Button>

          <AnimatePresence>
            {showAIMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-border-subtle bg-surface-2 shadow-lg py-1"
              >
                {([
                  { op: 'summarize' as const, icon: FileText },
                  { op: 'expand' as const, icon: Expand },
                  { op: 'rewrite-formal' as const, icon: PenLine },
                  { op: 'rewrite-casual' as const, icon: MessageSquare },
                  { op: 'extract-tasks' as const, icon: ListChecks },
                ]).map(({ op, icon: Icon }) => (
                  <button
                    key={op}
                    onClick={() => handleAIOperation(op)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {OPERATION_LABELS[op]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Undo AI */}
        {contentBeforeAI !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-yellow-500"
            onClick={handleUndoAI}
            title="Undo AI change"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="text-xs">Undo</span>
          </Button>
        )}

        {/* AI Error */}
        {lastError && (
          <span className="text-xs text-red-400 ml-2">{lastError}</span>
        )}
      </div>

      {/* Title Input */}
      <div className="px-6 pt-6">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="w-full text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-none text-white placeholder:text-white/30"
        />
      </div>

      {/* Editor */}
      <div className="flex-1 px-6 py-4 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start writing..."
          autoFocus={autoFocus}
          className={cn(
            'w-full h-full resize-none bg-transparent border-0 focus:ring-0 focus:outline-none',
            'text-base leading-relaxed text-white/90 placeholder:text-white/30',
            'font-sans' // Using sans-serif for better readability
          )}
          style={{ minHeight: '100%' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 text-xs text-white/50">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{content.length} characters</span>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-neon-primary"
            >
              Saving...
            </motion.span>
          )}
          <span>
            Last edited {new Date(note.last_edited_at).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

NoteEditor.displayName = 'NoteEditor';
