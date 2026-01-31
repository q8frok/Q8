'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronDown,
  Calendar,
  Clock,
  Tag as TagIcon,
  Sparkles,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';
import type { TaskEnhanced } from '@/lib/db/schemas/tasks-enhanced';
import { format } from 'date-fns';

interface TaskItemEnhancedProps {
  task: TaskEnhanced;
  subtasks?: TaskEnhanced[];
  onToggle: (task: TaskEnhanced) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask?: (parentId: string) => void;
  onAddTag?: (taskId: string, tag: string) => void;
  onRemoveTag?: (taskId: string, tag: string) => void;
  depth?: number;
}

export function TaskItemEnhanced({
  task,
  subtasks = [],
  onToggle,
  onDelete,
  onAddSubtask,
  onAddTag,
  onRemoveTag,
  depth = 0,
}: TaskItemEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  const isDone = task.status === 'done';
  const hasSubtasks = subtasks.length > 0;
  const completedSubtasks = subtasks.filter(st => st.status === 'done').length;

  const priorityColors = {
    low: 'text-blue-400 border-blue-400/30',
    medium: 'text-yellow-400 border-yellow-400/30',
    high: 'text-orange-400 border-orange-400/30',
    urgent: 'text-red-400 border-red-400/30',
  };

  const handleToggle = () => {
    haptics.selection();
    onToggle(task);
  };

  const handleExpand = () => {
    if (hasSubtasks) {
      haptics.light();
      setIsExpanded(!isExpanded);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && onAddTag) {
      onAddTag(task.id, newTag.trim());
      setNewTag('');
      setShowTagInput(false);
      haptics.success();
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (onRemoveTag) {
      onRemoveTag(task.id, tag);
      haptics.light();
    }
  };

  const handleDelete = () => {
    haptics.warning();
    onDelete(task.id);
  };

  return (
    <div className={cn('space-y-2', depth > 0 && 'ml-6')}>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          'group relative p-3 rounded-lg border transition-all',
          isDone ? 'bg-white/5 border-white/10' : 'bg-surface-3 border-border-subtle hover:border-border-strong',
          task.ai_generated && 'border-neon-primary/30'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Expand/Collapse */}
          {hasSubtasks && (
            <button
              onClick={handleExpand}
              className="mt-0.5 p-0.5 hover:bg-white/10 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/60" />
              )}
            </button>
          )}

          {/* Checkbox */}
          <button
            onClick={handleToggle}
            className="mt-0.5 flex-shrink-0"
          >
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-neon-primary" />
            ) : (
              <Circle className={cn('w-5 h-5', priorityColors[task.priority])} />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <div className="flex items-start gap-2">
              <p className={cn(
                'text-sm flex-1',
                isDone ? 'line-through text-white/40' : 'text-white/90'
              )}>
                {task.title}
              </p>
              {task.ai_generated && (
                <Sparkles className="w-3 h-3 text-neon-primary flex-shrink-0 mt-0.5" />
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-white/60 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              {/* Due Date */}
              {task.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(task.due_date), 'MMM d')}</span>
                </div>
              )}

              {/* Time Estimate */}
              {task.estimated_minutes && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{Math.floor(task.estimated_minutes / 60)}h {task.estimated_minutes % 60}m</span>
                </div>
              )}

              {/* Subtask Progress */}
              {hasSubtasks && (
                <span className="text-neon-primary">
                  {completedSubtasks}/{subtasks.length} subtasks
                </span>
              )}
            </div>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleRemoveTag(tag)}
                    className="px-2 py-0.5 text-xs bg-neon-primary/20 text-neon-primary rounded-full hover:bg-neon-primary/30 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Tag Input */}
            {showTagInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add tag..."
                  className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded focus:outline-none focus:border-neon-primary"
                  autoFocus
                />
                <button
                  onClick={handleAddTag}
                  className="px-2 py-1 text-xs bg-neon-primary/20 text-neon-primary rounded hover:bg-neon-primary/30"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddTag && !showTagInput && (
              <button
                onClick={() => setShowTagInput(true)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Add tag"
              >
                <TagIcon className="w-3 h-3 text-white/60" />
              </button>
            )}
            {onAddSubtask && (
              <button
                onClick={() => onAddSubtask(task.id)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Add subtask"
              >
                <Plus className="w-3 h-3 text-white/60" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Subtasks */}
      {isExpanded && hasSubtasks && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          {subtasks.map((subtask) => (
            <TaskItemEnhanced
              key={subtask.id}
              task={subtask}
              subtasks={[]}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              depth={depth + 1}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
