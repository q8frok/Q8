'use client';

import { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarSettings } from '../shared/CalendarSettings';
import { QuickAddModal } from './QuickAddModal';
import { EventDetailModal } from './EventDetailModal';
import { CalendarCommandCenter } from '../expanded/CalendarCommandCenter';
import type { CalendarEventDisplay, CalendarEventInput } from '../types';

export interface CalendarModalsProps {
  showSettings: boolean;
  onCloseSettings: () => void;
  showQuickAdd: boolean;
  onCloseQuickAdd: () => void;
  onQuickAddSave: (event: CalendarEventInput) => Promise<void>;
  selectedEvent: CalendarEventDisplay | null;
  onCloseEventDetail: () => void;
  onEditEvent: (event: CalendarEventDisplay) => void;
  onDeleteEvent: (eventId: string) => void;
  isExpanded: boolean;
  onCloseExpanded: () => void;
}

/**
 * Orchestrates all CalendarWidget modals and the expanded command center portal.
 */
export const CalendarModals = memo(function CalendarModals({
  showSettings,
  onCloseSettings,
  showQuickAdd,
  onCloseQuickAdd,
  onQuickAddSave,
  selectedEvent,
  onCloseEventDetail,
  onEditEvent,
  onDeleteEvent,
  isExpanded,
  onCloseExpanded,
}: CalendarModalsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Settings Drawer */}
      <CalendarSettings
        isOpen={showSettings}
        onClose={onCloseSettings}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={onCloseQuickAdd}
        onSave={onQuickAddSave}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={onCloseEventDetail}
        onEdit={onEditEvent}
        onDelete={onDeleteEvent}
      />

      {/* Expanded Command Center - Portal to body */}
      {mounted &&
        isExpanded &&
        createPortal(
          <CalendarCommandCenter onClose={onCloseExpanded} />,
          document.body
        )}
    </>
  );
});

CalendarModals.displayName = 'CalendarModals';

export default CalendarModals;
