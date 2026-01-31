import type { RxJsonSchema } from 'rxdb';
import type { ClockAlarm } from '@/hooks/useClockAlarms';

export const clockAlarmsSchema: RxJsonSchema<ClockAlarm> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    user_id: {
      type: 'string',
      maxLength: 100,
    },
    label: {
      type: 'string',
    },
    time: {
      type: 'string',
    },
    enabled: {
      type: 'boolean',
    },
    repeat_days: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
    sound: {
      type: 'string',
    },
    vibrate: {
      type: 'boolean',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
    deleted_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'user_id', 'label', 'time', 'enabled', 'repeat_days', 'sound', 'vibrate', 'created_at', 'updated_at'],
  indexes: ['user_id', 'time', 'enabled'],
};
