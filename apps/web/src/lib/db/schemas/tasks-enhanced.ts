import type { RxJsonSchema } from 'rxdb';

export interface TaskEnhanced {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  parent_task_id?: string;
  tags: string[];
  due_date?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  ai_generated: boolean;
  ai_context?: {
    prompt?: string;
    model?: string;
    generated_at?: string;
  };
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export const taskEnhancedSchema: RxJsonSchema<TaskEnhanced> = {
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
    title: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    status: {
      type: 'string',
      enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    parent_task_id: {
      type: 'string',
      maxLength: 100,
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    due_date: {
      type: 'string',
      format: 'date-time',
    },
    estimated_minutes: {
      type: 'number',
    },
    actual_minutes: {
      type: 'number',
    },
    ai_generated: {
      type: 'boolean',
    },
    ai_context: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        model: { type: 'string' },
        generated_at: { type: 'string' },
      },
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
  required: ['id', 'user_id', 'title', 'status', 'priority', 'tags', 'ai_generated', 'created_at', 'updated_at'],
  indexes: ['user_id', 'status', 'priority', 'parent_task_id', 'due_date', 'tags'],
};

export interface TaskTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export const taskTagSchema: RxJsonSchema<TaskTag> = {
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
    name: {
      type: 'string',
    },
    color: {
      type: 'string',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'user_id', 'name', 'color', 'created_at', 'updated_at'],
  indexes: ['user_id', 'name'],
};
