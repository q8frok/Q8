/**
 * Eval Suite - Test Prompts
 * 100 prompts across routing, memory, and tool domains
 * As defined in the AI Enhancement Plan
 */

import type { EvalPrompt } from './eval-harness';

/**
 * Routing Accuracy Prompts (50 total)
 */

// 10 Coding prompts
const codingPrompts: EvalPrompt[] = [
  {
    id: 'code-1',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Can you help me fix this bug in my JavaScript code?',
    expectedAgent: 'coder',
    expectedTools: ['github_search_code'],
  },
  {
    id: 'code-2',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'I need to implement a binary search algorithm in Python',
    expectedAgent: 'coder',
  },
  {
    id: 'code-3',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Check my latest GitHub PR for any issues',
    expectedAgent: 'coder',
    expectedTools: ['github_get_pr'],
  },
  {
    id: 'code-4',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Write a SQL query to find duplicate records in the users table',
    expectedAgent: 'coder',
    expectedTools: ['supabase_query'],
  },
  {
    id: 'code-5',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'How do I refactor this class to use dependency injection?',
    expectedAgent: 'coder',
  },
  {
    id: 'code-6',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Debug why my async function is throwing an unhandled promise rejection',
    expectedAgent: 'coder',
  },
  {
    id: 'code-7',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Review this code and suggest performance improvements',
    expectedAgent: 'coder',
  },
  {
    id: 'code-8',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Create a new branch and implement the user authentication feature',
    expectedAgent: 'coder',
  },
  {
    id: 'code-9',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'The API endpoint is returning a 500 error, help me troubleshoot',
    expectedAgent: 'coder',
  },
  {
    id: 'code-10',
    category: 'routing_accuracy',
    subcategory: 'coding',
    prompt: 'Merge the feature branch into main after fixing conflicts',
    expectedAgent: 'coder',
  },
];

// 10 Research prompts
const researchPrompts: EvalPrompt[] = [
  {
    id: 'research-1',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'What are the latest developments in quantum computing?',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-2',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Search for recent news about SpaceX Starship',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-3',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'What is the current stock price of NVIDIA?',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-4',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Find academic papers about transformer architectures',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-5',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Compare the pros and cons of React vs Vue.js',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-6',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'What happened at the tech conference today?',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-7',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Tell me about the latest iPhone release',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-8',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Look up information about climate change policies in Europe',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-9',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'What is the capital of Kazakhstan?',
    expectedAgent: 'researcher',
  },
  {
    id: 'research-10',
    category: 'routing_accuracy',
    subcategory: 'research',
    prompt: 'Research the best practices for microservices architecture',
    expectedAgent: 'researcher',
  },
];

// 10 Productivity prompts
const productivityPrompts: EvalPrompt[] = [
  {
    id: 'prod-1',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'What meetings do I have scheduled for tomorrow?',
    expectedAgent: 'secretary',
    expectedTools: ['calendar_list'],
  },
  {
    id: 'prod-2',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Send an email to John about the project update',
    expectedAgent: 'secretary',
    expectedTools: ['gmail_send'],
  },
  {
    id: 'prod-3',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Check my inbox for any urgent emails',
    expectedAgent: 'secretary',
    expectedTools: ['gmail_search'],
  },
  {
    id: 'prod-4',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Schedule a meeting with Sarah next Friday at 2pm',
    expectedAgent: 'secretary',
    expectedTools: ['calendar_create'],
  },
  {
    id: 'prod-5',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Find the quarterly report in my Google Drive',
    expectedAgent: 'secretary',
    expectedTools: ['drive_search'],
  },
  {
    id: 'prod-6',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Reschedule my 3pm appointment to 4pm',
    expectedAgent: 'secretary',
  },
  {
    id: 'prod-7',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Cancel all my meetings for today',
    expectedAgent: 'secretary',
  },
  {
    id: 'prod-8',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Draft a reply to the email from my manager',
    expectedAgent: 'secretary',
  },
  {
    id: 'prod-9',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'When is my next dentist appointment?',
    expectedAgent: 'secretary',
  },
  {
    id: 'prod-10',
    category: 'routing_accuracy',
    subcategory: 'productivity',
    prompt: 'Add a reminder to follow up with the client next week',
    expectedAgent: 'secretary',
  },
];

// 10 Finance prompts
const financePrompts: EvalPrompt[] = [
  {
    id: 'finance-1',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'What is my current account balance?',
    expectedAgent: 'finance',
    expectedTools: ['get_balance_sheet'],
  },
  {
    id: 'finance-2',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'How much did I spend on groceries last month?',
    expectedAgent: 'finance',
    expectedTools: ['get_spending_summary'],
  },
  {
    id: 'finance-3',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'Can I afford to buy a $500 TV this month?',
    expectedAgent: 'finance',
    expectedTools: ['can_i_afford'],
  },
  {
    id: 'finance-4',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'What subscriptions am I paying for?',
    expectedAgent: 'finance',
    expectedTools: ['find_subscriptions'],
  },
  {
    id: 'finance-5',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'Show me my net worth over the past year',
    expectedAgent: 'finance',
  },
  {
    id: 'finance-6',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'What bills are due this week?',
    expectedAgent: 'finance',
    expectedTools: ['get_upcoming_bills'],
  },
  {
    id: 'finance-7',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'Help me create a budget for next month',
    expectedAgent: 'finance',
  },
  {
    id: 'finance-8',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'How much did I save this quarter?',
    expectedAgent: 'finance',
  },
  {
    id: 'finance-9',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'Project my wealth in 10 years with 7% annual growth',
    expectedAgent: 'finance',
    expectedTools: ['project_wealth'],
  },
  {
    id: 'finance-10',
    category: 'routing_accuracy',
    subcategory: 'finance',
    prompt: 'Am I spending too much on dining out?',
    expectedAgent: 'finance',
  },
];

// 10 Home automation prompts
const homePrompts: EvalPrompt[] = [
  {
    id: 'home-1',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Turn on the living room lights',
    expectedAgent: 'home',
    expectedTools: ['control_device'],
  },
  {
    id: 'home-2',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Set the thermostat to 72 degrees',
    expectedAgent: 'home',
    expectedTools: ['set_climate'],
  },
  {
    id: 'home-3',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Lock all the doors in the house',
    expectedAgent: 'home',
    expectedTools: ['control_device'],
  },
  {
    id: 'home-4',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Activate the movie night scene',
    expectedAgent: 'home',
    expectedTools: ['activate_scene'],
  },
  {
    id: 'home-5',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Dim the bedroom lights to 50%',
    expectedAgent: 'home',
  },
  {
    id: 'home-6',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'What is the current temperature inside?',
    expectedAgent: 'home',
  },
  {
    id: 'home-7',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Turn off all the lights and lock up for the night',
    expectedAgent: 'home',
  },
  {
    id: 'home-8',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Open the garage door',
    expectedAgent: 'home',
  },
  {
    id: 'home-9',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'Turn on the ceiling fan in the office',
    expectedAgent: 'home',
  },
  {
    id: 'home-10',
    category: 'routing_accuracy',
    subcategory: 'home',
    prompt: 'What devices are currently on?',
    expectedAgent: 'home',
    expectedTools: ['get_devices'],
  },
];

/**
 * Memory Precision Prompts (30 total)
 */

// 10 Preference recall prompts
const preferenceRecallPrompts: EvalPrompt[] = [
  {
    id: 'mem-pref-1',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What is my favorite programming language?',
    expectedAgent: 'personality',
    notes: 'Should recall stored preference',
  },
  {
    id: 'mem-pref-2',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'Do I prefer detailed or concise responses?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-3',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What is my preferred name?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-4',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What theme do I use - light or dark?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-5',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What voice do I prefer for text-to-speech?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-6',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'Do I like coffee or tea?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-7',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What is my timezone?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-8',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'Do I prefer morning or evening meetings?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-9',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'What is my favorite music genre?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-pref-10',
    category: 'memory_precision',
    subcategory: 'preference',
    prompt: 'Do I like emojis in responses?',
    expectedAgent: 'personality',
  },
];

// 10 Task follow-up prompts
const taskFollowUpPrompts: EvalPrompt[] = [
  {
    id: 'mem-task-1',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'What was that task we discussed earlier?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-task-2',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'Continue working on the project from our last conversation',
    expectedAgent: 'coder',
  },
  {
    id: 'mem-task-3',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'What were the action items from yesterday?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-task-4',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'Did you finish the research I asked for?',
    expectedAgent: 'researcher',
  },
  {
    id: 'mem-task-5',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'What was the issue with the deployment we troubleshot?',
    expectedAgent: 'coder',
  },
  {
    id: 'mem-task-6',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'Remind me what meeting I was preparing for',
    expectedAgent: 'secretary',
  },
  {
    id: 'mem-task-7',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'What was the budget analysis result?',
    expectedAgent: 'finance',
  },
  {
    id: 'mem-task-8',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'Did you set up the automation I asked for?',
    expectedAgent: 'home',
  },
  {
    id: 'mem-task-9',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'Where did we leave off with the code review?',
    expectedAgent: 'coder',
  },
  {
    id: 'mem-task-10',
    category: 'memory_precision',
    subcategory: 'task_followup',
    prompt: 'What was the conclusion of our research discussion?',
    expectedAgent: 'researcher',
  },
];

// 10 Factual profile recall prompts
const factualRecallPrompts: EvalPrompt[] = [
  {
    id: 'mem-fact-1',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What company do I work for?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-2',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What is my job title?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-3',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'How many kids do I have?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-4',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What city do I live in?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-5',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What car do I drive?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-6',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What is my partner\'s name?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-7',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What is my primary bank?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-8',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What gym do I go to?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-9',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'What is my pet\'s name?',
    expectedAgent: 'personality',
  },
  {
    id: 'mem-fact-10',
    category: 'memory_precision',
    subcategory: 'factual',
    prompt: 'When is my birthday?',
    expectedAgent: 'personality',
  },
];

/**
 * Tool Appropriateness Prompts (20 total)
 */

// 10 Prompts requiring tools
const toolRequiredPrompts: EvalPrompt[] = [
  {
    id: 'tool-req-1',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Check the weather forecast for tomorrow',
    expectedAgent: 'personality',
    expectedTools: ['get_weather'],
  },
  {
    id: 'tool-req-2',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Play my favorite playlist on Spotify',
    expectedAgent: 'personality',
    expectedTools: ['spotify_play'],
  },
  {
    id: 'tool-req-3',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Find my latest commit on GitHub',
    expectedAgent: 'coder',
    expectedTools: ['github_search_code'],
  },
  {
    id: 'tool-req-4',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Get the balance of my checking account',
    expectedAgent: 'finance',
    expectedTools: ['get_balance_sheet'],
  },
  {
    id: 'tool-req-5',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Set an alarm for 7am tomorrow',
    expectedAgent: 'home',
    expectedTools: ['control_device'],
  },
  {
    id: 'tool-req-6',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Search the web for the latest AI news',
    expectedAgent: 'researcher',
    expectedTools: ['web_search'],
  },
  {
    id: 'tool-req-7',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Create a new calendar event',
    expectedAgent: 'secretary',
    expectedTools: ['calendar_create'],
  },
  {
    id: 'tool-req-8',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Query my database for user statistics',
    expectedAgent: 'coder',
    expectedTools: ['supabase_query'],
  },
  {
    id: 'tool-req-9',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Send a text message to my friend',
    expectedAgent: 'secretary',
  },
  {
    id: 'tool-req-10',
    category: 'tool_appropriateness',
    subcategory: 'requires_tools',
    prompt: 'Check if any devices are using too much energy',
    expectedAgent: 'home',
    expectedTools: ['get_devices'],
  },
];

// 10 Prompts where tool use is incorrect
const noToolPrompts: EvalPrompt[] = [
  {
    id: 'tool-no-1',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Tell me a joke',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-2',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'What is 2 + 2?',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-3',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Explain what a neural network is',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-4',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Write a haiku about programming',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-5',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'What is the meaning of life?',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-6',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Give me advice on time management',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-7',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'How are you doing today?',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-8',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'What should I name my new cat?',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-9',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Thanks for your help!',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
  {
    id: 'tool-no-10',
    category: 'tool_appropriateness',
    subcategory: 'no_tools_needed',
    prompt: 'Summarize this paragraph for me: [text]',
    expectedAgent: 'personality',
    shouldNotUseTools: true,
  },
];

/**
 * Complete eval suite
 */
export const EVAL_SUITE: EvalPrompt[] = [
  ...codingPrompts,
  ...researchPrompts,
  ...productivityPrompts,
  ...financePrompts,
  ...homePrompts,
  ...preferenceRecallPrompts,
  ...taskFollowUpPrompts,
  ...factualRecallPrompts,
  ...toolRequiredPrompts,
  ...noToolPrompts,
];

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: EvalPrompt['category']): EvalPrompt[] {
  return EVAL_SUITE.filter((p) => p.category === category);
}

/**
 * Get prompts by subcategory
 */
export function getPromptsBySubcategory(subcategory: string): EvalPrompt[] {
  return EVAL_SUITE.filter((p) => p.subcategory === subcategory);
}

/**
 * Get routing prompts only (first 50)
 */
export function getRoutingPrompts(): EvalPrompt[] {
  return getPromptsByCategory('routing_accuracy');
}

/**
 * Get memory prompts only
 */
export function getMemoryPrompts(): EvalPrompt[] {
  return getPromptsByCategory('memory_precision');
}

/**
 * Get tool prompts only
 */
export function getToolPrompts(): EvalPrompt[] {
  return getPromptsByCategory('tool_appropriateness');
}
