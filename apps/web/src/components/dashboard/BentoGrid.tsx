'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWidgetOrder,
  useDashboardActions,
  type DashboardWidgetId,
} from '@/lib/stores/dashboard';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * BentoGrid v3.0
 *
 * Responsive dashboard grid with drag-and-drop reordering.
 * Uses @dnd-kit for accessible drag interactions.
 * Widget order persists to localStorage via Zustand.
 */
export function BentoGrid({ children, className }: BentoGridProps) {
  const widgetOrder = useWidgetOrder();
  const { reorderWidgets } = useDashboardActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = widgetOrder.indexOf(active.id as DashboardWidgetId);
      const newIndex = widgetOrder.indexOf(over.id as DashboardWidgetId);

      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...widgetOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as DashboardWidgetId);
      reorderWidgets(newOrder);
    },
    [widgetOrder, reorderWidgets]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(160px,auto)]',
            'gap-2 sm:gap-3 md:gap-4',
            'p-2 sm:p-3 md:p-4 safe-area-bottom',
            className
          )}
        >
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface BentoItemProps {
  children: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  /** Widget ID for drag-and-drop sorting. If not provided, item is not draggable. */
  id?: string;
}

/**
 * BentoItem - Sortable grid item container
 *
 * When `id` is provided, the item becomes draggable with a grip handle.
 */
export function BentoItem({
  children,
  colSpan = 1,
  rowSpan = 1,
  className,
  id,
}: BentoItemProps) {
  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 sm:col-span-2 md:col-span-2',
    3: 'col-span-1 sm:col-span-2 md:col-span-3',
    4: 'col-span-1 sm:col-span-2 md:col-span-4',
  };

  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  if (!id) {
    return (
      <motion.div
        layout
        className={cn(
          'surface-matte relative overflow-hidden w-full',
          colSpanClasses[colSpan],
          rowSpanClasses[rowSpan],
          className
        )}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <SortableBentoItem
      id={id}
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={className}
    >
      {children}
    </SortableBentoItem>
  );
}

interface SortableBentoItemProps {
  id: string;
  children: React.ReactNode;
  colSpan: number;
  rowSpan: number;
  className?: string;
}

function SortableBentoItem({
  id,
  children,
  colSpan,
  rowSpan,
  className,
}: SortableBentoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 sm:col-span-2 md:col-span-2',
    3: 'col-span-1 sm:col-span-2 md:col-span-3',
    4: 'col-span-1 sm:col-span-2 md:col-span-4',
  };

  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'surface-matte relative overflow-hidden w-full group',
        colSpanClasses[colSpan],
        rowSpanClasses[rowSpan],
        isDragging && 'ring-2 ring-neon-primary/50 shadow-lg shadow-neon-primary/20',
        className
      )}
    >
      {/* Drag Handle */}
      <button
        className={cn(
          'absolute top-2 right-2 z-10 p-1.5 rounded-lg',
          'bg-surface-3/80 backdrop-blur-sm border border-border-subtle',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-surface-2 cursor-grab active:cursor-grabbing',
          'hidden md:flex items-center justify-center'
        )}
        aria-label="Drag to reorder widget"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-text-muted" />
      </button>
      {children}
    </div>
  );
}
