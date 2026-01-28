import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/auth/api-auth';
import {
  createTaskSchema,
  validationErrorResponse,
} from '@/lib/validations';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/tasks
 * Fetch tasks for the authenticated user with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // Parse query parameters manually to support comma-separated status values
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const projectId = searchParams.get('projectId');
    const parentTaskId = searchParams.get('parentTaskId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // Build query
    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Support comma-separated status values
    if (statusParam) {
      const statuses = statusParam.split(',').filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    if (priorityParam) {
      query = query.eq('priority', priorityParam);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // Handle parentTaskId filter (null for top-level tasks)
    if (parentTaskId === 'null') {
      query = query.is('parent_task_id', null);
    } else if (parentTaskId) {
      query = query.eq('parent_task_id', parentTaskId);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Tasks fetch error', { error, userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform snake_case to camelCase for frontend
    const tasks = data?.map((task) => ({
      id: task.id,
      userId: task.user_id,
      title: task.title || task.text || 'Untitled Task',
      description: task.description,
      dueDate: task.due_date,
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      tags: task.tags || [],
      projectId: task.project_id,
      parentTaskId: task.parent_task_id,
      sortOrder: task.sort_order || 0,
      estimatedMinutes: task.estimated_minutes,
      completedAt: task.completed_at,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    })) ?? [];

    return NextResponse.json({
      tasks,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Tasks error', { error });
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate request body
    const result = createTaskSchema.safeParse(body);
    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const { title, description, dueDate, priority, status, tags, projectId, parentTaskId, sortOrder, estimatedMinutes } = result.data;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description,
        due_date: dueDate,
        priority,
        status,
        tags,
        project_id: projectId,
        parent_task_id: parentTaskId,
        sort_order: sortOrder,
        estimated_minutes: estimatedMinutes,
      })
      .select()
      .single();

    if (error) {
      logger.error('Task creation error', { error, userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description,
      dueDate: data.due_date,
      priority: data.priority,
      status: data.status,
      tags: data.tags,
      projectId: data.project_id,
      parentTaskId: data.parent_task_id,
      sortOrder: data.sort_order,
      estimatedMinutes: data.estimated_minutes,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }, { status: 201 });
  } catch (error) {
    logger.error('Create task error', { error });
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks
 * Update an existing task
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Transform camelCase to snake_case for Supabase
    const supabaseUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) supabaseUpdates.title = updates.title;
    if (updates.description !== undefined) supabaseUpdates.description = updates.description;
    if (updates.status !== undefined) {
      supabaseUpdates.status = updates.status;
      // completed_at is handled by database trigger when status changes to 'done'
    }
    if (updates.priority !== undefined) supabaseUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) supabaseUpdates.due_date = updates.dueDate;
    if (updates.tags !== undefined) supabaseUpdates.tags = updates.tags;
    if (updates.projectId !== undefined) supabaseUpdates.project_id = updates.projectId;
    if (updates.parentTaskId !== undefined) supabaseUpdates.parent_task_id = updates.parentTaskId;
    if (updates.sortOrder !== undefined) supabaseUpdates.sort_order = updates.sortOrder;
    if (updates.estimatedMinutes !== undefined) supabaseUpdates.estimated_minutes = updates.estimatedMinutes;

    const { data, error } = await supabase
      .from('tasks')
      .update(supabaseUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('Task update error', { error, userId: user.id, taskId: id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      task: {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        description: data.description,
        dueDate: data.due_date,
        priority: data.priority,
        status: data.status,
        tags: data.tags,
        projectId: data.project_id,
        parentTaskId: data.parent_task_id,
        sortOrder: data.sort_order,
        estimatedMinutes: data.estimated_minutes,
        completedAt: data.completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    logger.error('Update task error', { error });
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks
 * Delete a task
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      logger.error('Task delete error', { error, userId: user.id, taskId: id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete task error', { error });
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
