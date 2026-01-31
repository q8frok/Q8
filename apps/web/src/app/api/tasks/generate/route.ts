import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    const supabase = createServerClient(accessToken);
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, parentTaskId } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a task breakdown assistant. Given a high-level task or goal, break it down into actionable subtasks.
Return a JSON array of tasks with the following structure:
[
  {
    "title": "Task title",
    "description": "Optional description",
    "priority": "low" | "medium" | "high" | "urgent",
    "estimated_minutes": number (optional),
    "tags": ["tag1", "tag2"] (optional)
  }
]

Keep tasks specific, actionable, and well-scoped. Estimate time realistically.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : parsed;

    const now = new Date().toISOString();
    const tasksToInsert = tasks.map((task: any) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      title: task.title,
      description: task.description || null,
      status: 'todo',
      priority: task.priority || 'medium',
      parent_task_id: parentTaskId || null,
      tags: task.tags || [],
      estimated_minutes: task.estimated_minutes || null,
      ai_generated: true,
      ai_context: {
        prompt,
        model: 'gpt-4',
        generated_at: now,
      },
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    if (error) {
      console.error('Failed to insert AI-generated tasks:', error);
      return NextResponse.json({ error: 'Failed to save tasks' }, { status: 500 });
    }

    return NextResponse.json({ tasks: data });
  } catch (error) {
    console.error('Task generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
