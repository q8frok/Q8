'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRxCollection } from 'rxdb-hooks';
import type { RxDocument } from 'rxdb';
import { logger } from '@/lib/logger';

export interface ClockAlarm {
  id: string;
  user_id: string;
  label: string;
  time: string;
  enabled: boolean;
  repeat_days: number[];
  sound: string;
  vibrate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

type _AlarmDocument = RxDocument<ClockAlarm>;

export function useClockAlarms(userId: string) {
  const collection = useRxCollection<ClockAlarm>('clock_alarms');
  const [alarms, setAlarms] = useState<ClockAlarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlarms = useCallback(async () => {
    if (!collection) return;

    try {
      const docs = await collection
        .find({
          selector: {
            user_id: userId,
            deleted_at: { $exists: false },
          },
          sort: [{ time: 'asc' }],
        })
        .exec();

      setAlarms(docs.map((doc) => doc.toJSON() as ClockAlarm));
    } catch (error) {
      logger.error('Failed to fetch alarms', { error });
    } finally {
      setIsLoading(false);
    }
  }, [collection, userId]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  useEffect(() => {
    if (!collection) return;

    const subscription = collection
      .find({
        selector: {
          user_id: userId,
          deleted_at: { $exists: false },
        },
      })
      .$.subscribe((docs) => {
        setAlarms(docs.map((doc) => doc.toJSON() as ClockAlarm));
      });

    return () => subscription.unsubscribe();
  }, [collection, userId]);

  const addAlarm = useCallback(
    async (alarm: Omit<ClockAlarm, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!collection) return null;

      try {
        const now = new Date().toISOString();
        const doc = await collection.insert({
          id: crypto.randomUUID(),
          user_id: userId,
          ...alarm,
          created_at: now,
          updated_at: now,
        });

        return doc.toJSON();
      } catch (error) {
        logger.error('Failed to add alarm', { error });
        return null;
      }
    },
    [collection, userId]
  );

  const updateAlarm = useCallback(
    async (id: string, updates: Partial<ClockAlarm>) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(id).exec();
        if (!doc) return false;

        await doc.update({
          $set: {
            ...updates,
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to update alarm', { error });
        return false;
      }
    },
    [collection]
  );

  const deleteAlarm = useCallback(
    async (id: string) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(id).exec();
        if (!doc) return false;

        await doc.update({
          $set: {
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to delete alarm', { error });
        return false;
      }
    },
    [collection]
  );

  const toggleAlarm = useCallback(
    async (id: string) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(id).exec();
        if (!doc) return false;

        const currentEnabled = doc.get('enabled');
        await doc.update({
          $set: {
            enabled: !currentEnabled,
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to toggle alarm', { error });
        return false;
      }
    },
    [collection]
  );

  return {
    alarms,
    isLoading,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm,
  };
}
