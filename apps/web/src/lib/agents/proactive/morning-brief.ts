/**
 * Daily Brief Generator
 * Generates a daily briefing with quick actions and insights
 * Evolved from morning-only to all-day relevance
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { listCalendarEvents } from '@/lib/mcp/tools/google';
import { getWeather } from '../sdk/tools/weather';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =============================================================================
// TYPES
// =============================================================================

export type QuickActionType = 'chat' | 'navigate' | 'widget-action';

export interface QuickAction {
  id: string;
  label: string;
  icon: 'calendar' | 'task' | 'weather' | 'chat' | 'home' | 'search';
  type: QuickActionType;
  /** For 'chat' type — message sent to chat */
  chatMessage?: string;
  /** For 'navigate' type — widget to open */
  navigateTo?: { widget: string; view?: string };
  /** Legacy field — kept for backward compatibility */
  action?: string;
}

export interface Insight {
  id: string;
  type: 'tip' | 'reminder' | 'follow-up' | 'alert' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dismissible: boolean;
  action?: {
    label: string;
    message: string;
  };
}

export interface DailyBriefContent {
  greeting: string;
  date: string;
  summary: string;
  calendar: {
    events: Array<{
      title: string;
      time: string;
      location?: string;
      isAllDay?: boolean;
    }>;
    summary: string;
  };
  weather?: {
    temp: number;
    condition: string;
    high: number;
    low: number;
    description: string;
  };
  tasks?: BriefTasksData;
  quote?: {
    text: string;
    author: string;
  };
  // NEW: Quick Actions
  quickActions: QuickAction[];
  // NEW: Insights/Suggestions
  insights: Insight[];
  // Metadata
  generatedAt: string;
  refreshedAt?: string;
  nextRefresh?: string;
}

// Legacy type alias for backward compatibility
export type MorningBriefContent = DailyBriefContent;

// =============================================================================
// QUICK ACTIONS GENERATION
// =============================================================================

/**
 * Generate context-aware quick actions
 */
function generateQuickActions(
  timeOfDay: string,
  weather: DailyBriefContent['weather'] | null,
  hasEvents: boolean,
  hasUrgentTasks: boolean,
  dayOfWeek: string
): QuickAction[] {
  const actions: QuickAction[] = [];
  let idCounter = 0;
  const nextId = () => `qa_${Date.now()}_${idCounter++}`;

  // Time-based actions
  if (timeOfDay === 'morning') {
    actions.push({
      id: nextId(),
      label: 'View Calendar',
      icon: 'calendar',
      type: 'navigate',
      navigateTo: { widget: 'calendar' },
    });
    if (dayOfWeek !== 'Saturday' && dayOfWeek !== 'Sunday') {
      actions.push({
        id: nextId(),
        label: 'Ask About Emails',
        icon: 'chat',
        type: 'chat',
        chatMessage: 'Any important emails I should know about?',
      });
    }
  } else if (timeOfDay === 'afternoon') {
    actions.push({
      id: nextId(),
      label: 'View Tasks',
      icon: 'task',
      type: 'navigate',
      navigateTo: { widget: 'tasks' },
    });
  } else if (timeOfDay === 'evening') {
    actions.push({
      id: nextId(),
      label: 'Day Summary',
      icon: 'chat',
      type: 'chat',
      chatMessage: 'Give me a summary of today',
    });
    actions.push({
      id: nextId(),
      label: "Tomorrow's Calendar",
      icon: 'calendar',
      type: 'navigate',
      navigateTo: { widget: 'calendar' },
    });
  } else if (timeOfDay === 'night') {
    actions.push({
      id: nextId(),
      label: 'Goodnight Routine',
      icon: 'home',
      type: 'chat',
      chatMessage: 'Run my goodnight routine',
    });
  }

  // Weather-based actions
  if (weather) {
    const condition = weather.condition.toLowerCase();
    if (condition.includes('rain') || condition.includes('snow')) {
      actions.push({
        id: nextId(),
        label: 'Weather Details',
        icon: 'weather',
        type: 'navigate',
        navigateTo: { widget: 'weather' },
      });
    }
  }

  // Calendar-based actions
  if (hasEvents) {
    actions.push({
      id: nextId(),
      label: 'Next Meeting',
      icon: 'calendar',
      type: 'navigate',
      navigateTo: { widget: 'calendar' },
    });
  }

  // Task-based actions
  if (hasUrgentTasks) {
    actions.push({
      id: nextId(),
      label: 'Focus on Tasks',
      icon: 'task',
      type: 'navigate',
      navigateTo: { widget: 'tasks' },
    });
  }

  // Always available
  actions.push({
    id: nextId(),
    label: 'Smart Home',
    icon: 'home',
    type: 'navigate',
    navigateTo: { widget: 'home' },
  });

  return actions.slice(0, 6);
}

// =============================================================================
// INSIGHTS GENERATION
// =============================================================================

/**
 * Generate context-aware insights
 */
function generateInsights(
  timeOfDay: string,
  weather: DailyBriefContent['weather'] | null,
  events: DailyBriefContent['calendar']['events'],
  tasks: DailyBriefContent['tasks'],
  dayOfWeek: string
): Insight[] {
  const insights: Insight[] = [];
  let idCounter = 0;
  const nextId = () => `insight_${Date.now()}_${idCounter++}`;

  // Time-based insights
  if (timeOfDay === 'morning') {
    insights.push({
      id: nextId(),
      type: 'tip',
      title: 'Morning Tip',
      description: 'Start your day by reviewing your top 3 priorities.',
      priority: 'low',
      dismissible: true,
      action: {
        label: 'Set priorities',
        message: 'Help me identify my top 3 priorities for today',
      },
    });
  } else if (timeOfDay === 'evening') {
    insights.push({
      id: nextId(),
      type: 'tip',
      title: 'Evening Review',
      description: 'Consider reflecting on what you accomplished today.',
      priority: 'low',
      dismissible: true,
      action: {
        label: 'Review day',
        message: 'What did I accomplish today?',
      },
    });
  }

  // Weather-based insights
  if (weather) {
    const condition = weather.condition.toLowerCase();

    if (condition.includes('rain') || condition.includes('drizzle')) {
      insights.push({
        id: nextId(),
        type: 'alert',
        title: 'Rain Expected',
        description: "Don't forget your umbrella today!",
        priority: 'medium',
        dismissible: true,
      });
    }

    if (condition.includes('snow')) {
      insights.push({
        id: nextId(),
        type: 'alert',
        title: 'Snow Alert',
        description: 'Bundle up and allow extra travel time.',
        priority: 'high',
        dismissible: true,
        action: {
          label: 'Check conditions',
          message: 'What are the road conditions today?',
        },
      });
    }

    if (weather.temp > 85) {
      insights.push({
        id: nextId(),
        type: 'tip',
        title: 'Hot Weather',
        description: `It's ${Math.round(weather.temp)}°F - stay hydrated!`,
        priority: 'medium',
        dismissible: true,
      });
    }

    if (weather.temp < 32) {
      insights.push({
        id: nextId(),
        type: 'alert',
        title: 'Freezing Conditions',
        description: `It's ${Math.round(weather.temp)}°F - dress warmly!`,
        priority: 'medium',
        dismissible: true,
      });
    }

    // Nice weather for outdoor activities
    if (
      (condition.includes('clear') || condition.includes('sunny')) &&
      weather.temp >= 60 &&
      weather.temp <= 80 &&
      timeOfDay !== 'night'
    ) {
      insights.push({
        id: nextId(),
        type: 'recommendation',
        title: 'Great Weather',
        description: 'Perfect conditions for outdoor activities!',
        priority: 'low',
        dismissible: true,
        action: {
          label: 'Find activities',
          message: 'What outdoor activities can I do nearby?',
        },
      });
    }
  }

  // Calendar-based insights
  if (events.length > 0) {
    const now = new Date();
    const currentHour = now.getHours();

    // Check for upcoming meetings within 30-60 minutes
    for (const event of events) {
      if (event.time !== 'All day') {
        // Parse time like "10:30 AM"
        const match = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match && match[1] && match[2] && match[3]) {
          let hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          const isPM = match[3].toUpperCase() === 'PM';

          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;

          const eventMinutes = hour * 60 + minute;
          const nowMinutes = currentHour * 60 + now.getMinutes();
          const diff = eventMinutes - nowMinutes;

          if (diff > 0 && diff <= 60) {
            insights.push({
              id: nextId(),
              type: 'reminder',
              title: `Meeting in ${diff} min`,
              description: event.title + (event.location ? ` at ${event.location}` : ''),
              priority: diff <= 30 ? 'high' : 'medium',
              dismissible: false,
              action: {
                label: 'Prepare',
                message: `Help me prepare for my meeting: "${event.title}"`,
              },
            });
            break; // Only show the next upcoming meeting
          }
        }
      }
    }

    // Busy day alert
    if (events.length >= 5) {
      insights.push({
        id: nextId(),
        type: 'alert',
        title: 'Busy Day Ahead',
        description: `You have ${events.length} events scheduled today.`,
        priority: 'medium',
        dismissible: true,
        action: {
          label: 'Optimize',
          message: 'Help me optimize my schedule for today',
        },
      });
    }
  }

  // Task-based insights
  if (tasks) {
    if (tasks.urgent.length > 0) {
      insights.push({
        id: nextId(),
        type: 'alert',
        title: 'Urgent Tasks',
        description: `You have ${tasks.urgent.length} urgent task${tasks.urgent.length > 1 ? 's' : ''} requiring attention.`,
        priority: 'high',
        dismissible: false,
        action: {
          label: 'Focus',
          message: 'What are my urgent tasks and how should I prioritize them?',
        },
      });
    }

    if (tasks.today.length > 3) {
      insights.push({
        id: nextId(),
        type: 'tip',
        title: 'Task Load',
        description: `${tasks.today.length} tasks due today. Consider prioritizing the most impactful ones.`,
        priority: 'medium',
        dismissible: true,
        action: {
          label: 'Prioritize',
          message: "Help me prioritize today's tasks",
        },
      });
    }
  }

  // Day-of-week insights
  if (dayOfWeek === 'Monday' && timeOfDay === 'morning') {
    insights.push({
      id: nextId(),
      type: 'tip',
      title: 'Week Start',
      description: 'Set your intentions for the week ahead.',
      priority: 'low',
      dismissible: true,
      action: {
        label: 'Plan week',
        message: 'Help me plan my week',
      },
    });
  }

  if (dayOfWeek === 'Friday' && timeOfDay === 'afternoon') {
    insights.push({
      id: nextId(),
      type: 'tip',
      title: 'Week Wrap-up',
      description: 'Good time to review accomplishments and plan for next week.',
      priority: 'low',
      dismissible: true,
      action: {
        label: 'Review week',
        message: 'Give me a summary of this week',
      },
    });
  }

  // Sort by priority and limit
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  return insights.slice(0, 7); // Limit to 7 insights
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

/**
 * Generate a daily brief for a user
 */
export async function generateMorningBrief(userId: string): Promise<DailyBriefContent> {
  const now = new Date();

  // Fetch user profile from Supabase
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name, timezone, preferences')
    .eq('user_id', userId)
    .single();

  const timezone = profile?.timezone || 'America/New_York';
  const userName = profile?.display_name || 'there';
  const userLocation = (profile?.preferences as Record<string, unknown>)?.location as { lat?: number; long?: number } | undefined;

  // Parallel data fetching
  const [calendarData, weatherData, tasksData] = await Promise.all([
    fetchCalendarEvents(userId, timezone),
    fetchWeather(userLocation),
    fetchTasks(userId),
  ]);

  // Format date
  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  // Get day of week
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });

  // Generate greeting based on time
  const hour = parseInt(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
  let greeting = 'Good morning';
  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
    timeOfDay = 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good evening';
    timeOfDay = 'evening';
  } else if (hour >= 21 || hour < 5) {
    greeting = 'Good evening';
    timeOfDay = 'night';
  }

  // Generate AI summary
  const summary = await generateBriefSummary({
    userName,
    dateFormatted,
    calendarEvents: calendarData.events,
    weather: weatherData,
    tasks: tasksData,
    timeOfDay,
  });

  // Generate quick actions
  const quickActions = generateQuickActions(
    timeOfDay,
    weatherData,
    calendarData.events.length > 0,
    (tasksData?.urgent.length || 0) > 0,
    dayOfWeek
  );

  // Generate insights
  const insights = generateInsights(
    timeOfDay,
    weatherData,
    calendarData.events,
    tasksData,
    dayOfWeek
  );

  // Build the brief
  const brief: DailyBriefContent = {
    greeting: `${greeting}, ${userName}!`,
    date: dateFormatted,
    summary,
    calendar: calendarData,
    weather: weatherData || undefined,
    tasks: tasksData,
    quote: await getDailyQuote(),
    quickActions,
    insights,
    generatedAt: now.toISOString(),
    nextRefresh: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
  };

  // Store the brief
  await storeBrief(userId, brief);

  return brief;
}

/**
 * Fetch today's calendar events
 */
async function fetchCalendarEvents(
  userId: string,
  timezone: string
): Promise<DailyBriefContent['calendar']> {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const eventsResponse = await listCalendarEvents('primary', startOfDay.toISOString(), endOfDay.toISOString());
    const events = Array.isArray(eventsResponse) ? eventsResponse : (eventsResponse as { items?: unknown[] })?.items || [];

    if (!events || events.length === 0) {
      return {
        events: [],
        summary: 'No events scheduled for today.',
      };
    }

    const formattedEvents = (events as Array<Record<string, unknown>>).slice(0, 10).map((event: Record<string, unknown>) => {
      const start = event.start as { dateTime?: string; date?: string };
      const isAllDay = !start?.dateTime;

      let time = 'All day';
      if (start?.dateTime) {
        time = new Date(start.dateTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone,
        });
      }

      return {
        title: (event.summary as string) || 'Untitled Event',
        time,
        location: event.location as string | undefined,
        isAllDay,
      };
    });

    const summary = events.length === 1
      ? 'You have 1 event today.'
      : `You have ${events.length} events today.`;

    return { events: formattedEvents, summary };
  } catch (error) {
    logger.warn('Failed to fetch calendar events for brief', { userId, error });
    return {
      events: [],
      summary: 'Unable to fetch calendar events.',
    };
  }
}

/**
 * Fetch weather data
 */
async function fetchWeather(
  location?: { lat?: number; long?: number } | null
): Promise<DailyBriefContent['weather'] | null> {
  try {
    if (!location?.lat || !location?.long) {
      return null;
    }

    const result = await getWeather({ lat: location.lat, lon: location.long });
    if (!result.success) return null;

    const w = result.weather;
    return {
      temp: Math.round(w.temp),
      condition: w.condition,
      high: Math.round(w.tempMax),
      low: Math.round(w.tempMin),
      description: w.description,
    };
  } catch (error) {
    logger.warn('Failed to fetch weather for brief', { error });
    return null;
  }
}

/**
 * Fetch user's tasks
 */
interface BriefTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  isUrgent: boolean;
}

interface BriefTasksData {
  urgent: BriefTask[];
  today: BriefTask[];
  totalActive: number;
}

async function fetchTasks(
  userId: string
): Promise<BriefTasksData> {
  try {
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, priority, due_date, status')
      .eq('user_id', userId)
      .neq('status', 'done')
      .order('priority', { ascending: false })
      .limit(10);

    if (!tasks || tasks.length === 0) {
      return { urgent: [], today: [], totalActive: 0 };
    }

    const toBriefTask = (t: { id: string; title: string; priority: string; due_date?: string; status: string }, isUrgent: boolean): BriefTask => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      isUrgent,
    });

    const urgent = tasks
      .filter((t: { priority: string }) => t.priority === 'urgent' || t.priority === 'high')
      .map((t: { id: string; title: string; priority: string; due_date?: string; status: string }) => toBriefTask(t, true));

    const today = tasks
      .filter((t: { due_date?: string; priority: string }) => {
        if (t.priority === 'urgent' || t.priority === 'high') return false; // Already in urgent
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        const now = new Date();
        return due.toDateString() === now.toDateString();
      })
      .map((t: { id: string; title: string; priority: string; due_date?: string; status: string }) => toBriefTask(t, false));

    return { urgent, today, totalActive: tasks.length };
  } catch (error) {
    logger.warn('Failed to fetch tasks for brief', { userId, error });
    return { urgent: [], today: [], totalActive: 0 };
  }
}

/**
 * Generate AI summary of the brief
 */
async function generateBriefSummary(data: {
  userName: string;
  dateFormatted: string;
  calendarEvents: DailyBriefContent['calendar']['events'];
  weather: DailyBriefContent['weather'] | null;
  tasks: DailyBriefContent['tasks'];
  timeOfDay: string;
}): Promise<string> {
  try {
    const timeContext = data.timeOfDay === 'morning' ? 'morning' :
                       data.timeOfDay === 'afternoon' ? 'afternoon' :
                       data.timeOfDay === 'evening' ? 'evening' : 'day';

    const prompt = `Generate a brief, friendly ${timeContext} summary for ${data.userName}.
Today is ${data.dateFormatted}.

Calendar: ${data.calendarEvents.length} events
${data.calendarEvents.map(e => `- ${e.time}: ${e.title}`).join('\n')}

${data.weather ? `Weather: ${data.weather.temp}°F, ${data.weather.description}` : 'Weather: Not available'}

${data.tasks?.urgent.length ? `Urgent tasks: ${data.tasks.urgent.map((t: { title: string }) => t.title).join(', ')}` : ''}
${data.tasks?.today.length ? `Due today: ${data.tasks.today.map((t: { title: string }) => t.title).join(', ')}` : ''}

Write 2-3 sentences highlighting the most important things for ${data.timeOfDay === 'morning' ? 'today' : 'the rest of the day'}. Be warm but concise.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful personal assistant. Keep responses brief and friendly.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Have a great day!';
  } catch (error) {
    logger.warn('Failed to generate brief summary', { error });
    return "Here's your daily overview. Have a productive day!";
  }
}

/**
 * Get a daily inspirational quote
 */
async function getDailyQuote(): Promise<DailyBriefContent['quote']> {
  // Simple rotating quotes - in production, could use an API
  const quotes = [
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Every morning brings new potential.', author: 'Unknown' },
    { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  ];

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

/**
 * Store the brief in the database
 */
async function storeBrief(userId: string, content: DailyBriefContent): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('proactive_briefs')
    .insert({
      user_id: userId,
      brief_type: 'morning_brief',
      content,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to store morning brief', { userId, error });
    throw error;
  }

  return data.id;
}

/**
 * Get the latest morning brief for a user
 */
export async function getLatestMorningBrief(userId: string): Promise<DailyBriefContent | null> {
  const { data, error } = await supabaseAdmin
    .from('proactive_briefs')
    .select('content')
    .eq('user_id', userId)
    .eq('brief_type', 'morning_brief')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.content as DailyBriefContent;
}

/**
 * Check if user has unread brief today
 */
export async function hasUnreadBriefToday(userId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('proactive_briefs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('brief_type', 'morning_brief')
    .gte('created_at', startOfDay.toISOString())
    .is('read_at', null);

  return !error && (count || 0) > 0;
}
