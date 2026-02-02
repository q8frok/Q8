'use client';

import { CheckSquare, Circle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from './CollapsibleSection';
import { TASK_PRIORITY_STYLES } from '../constants';
import type { BriefTask } from '../types';

interface TasksPreviewProps {
  urgentTasks: BriefTask[];
  todayTasks: BriefTask[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleTask: (taskId: string) => void;
}

function TaskRow({
  task,
  label,
  labelStyle,
  onToggle,
}: {
  task: BriefTask;
  label: string;
  labelStyle: string;
  onToggle: (taskId: string) => void;
}) {
  const isCompleted = task.status === 'done';
  const isLegacy = task.id.startsWith('legacy-');

  return (
    <div className="flex items-center gap-2 text-sm group">
      {!isLegacy ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className="flex-shrink-0 hover:scale-110 transition-transform"
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Circle className="w-4 h-4 text-white/30 group-hover:text-white/60" />
          )}
        </button>
      ) : (
        <div className="w-4 h-4 flex-shrink-0" />
      )}
      <span className={cn('px-1.5 py-0.5 text-xs rounded flex-shrink-0', labelStyle)}>
        {label}
      </span>
      <span
        className={cn(
          'text-white/80 truncate',
          isCompleted && 'line-through text-white/40'
        )}
      >
        {task.title}
      </span>
    </div>
  );
}

export function TasksPreview({
  urgentTasks,
  todayTasks,
  isOpen,
  onToggle,
  onToggleTask,
}: TasksPreviewProps) {
  if (urgentTasks.length === 0 && todayTasks.length === 0) return null;

  const totalCount = urgentTasks.length + todayTasks.length;
  const completedCount = [...urgentTasks, ...todayTasks].filter(
    (t) => t.status === 'done'
  ).length;

  return (
    <CollapsibleSection
      icon={<CheckSquare className="w-4 h-4 text-green-400" />}
      title="Tasks"
      badge={completedCount > 0 ? `${completedCount}/${totalCount}` : `${totalCount}`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        {urgentTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            label="Urgent"
            labelStyle={TASK_PRIORITY_STYLES.urgent || 'bg-red-500/20 text-red-400'}
            onToggle={onToggleTask}
          />
        ))}
        {todayTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            label="Today"
            labelStyle="bg-blue-500/20 text-blue-400"
            onToggle={onToggleTask}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}
