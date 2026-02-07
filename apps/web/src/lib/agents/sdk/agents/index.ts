/**
 * Agent Definitions using @openai/agents SDK — OpenAI-only
 *
 * All agents use native OpenAI model strings, which lets the SDK use
 * the Responses API directly. This eliminates:
 * - aisdk() adapter overhead
 * - Cross-provider schema incompatibilities (thought_signature, enum type)
 * - Reasoning item pairing bugs
 *
 * Hosted tools (webSearchTool, imageGenerationTool, codeInterpreterTool)
 * run on OpenAI's infrastructure — zero custom code needed.
 */

import { z } from 'zod';
import { Agent, handoff, webSearchTool, imageGenerationTool, codeInterpreterTool } from '@openai/agents';
import type { Tool } from '@openai/agents';
import { defaultTools } from '../tools/default';
import { githubTools } from '../tools/github';
import { spotifyTools } from '../tools/spotify';
import { googleTools } from '../tools/google';
import { homeTools } from '../tools/home';
import { ouraTools } from '../tools/oura';
import { financeTools } from '../tools/finance';
import { getAgentModel } from '../model-provider';
import { OUTPUT_DIRECTIVE } from './output-directive';

// =============================================================================
// Agent Type Schema
// =============================================================================

export const AgentTypeSchema = z.enum([
  'orchestrator',
  'coder',
  'researcher',
  'secretary',
  'personality',
  'home',
  'finance',
  'imagegen',
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

// =============================================================================
// Agent Instructions
// =============================================================================

const ORCHESTRATOR_INSTRUCTIONS = `You are Q8, a personal AI assistant.

Your role:
- Answer general questions directly and quickly
- Delegate specialist tasks to the right internal capability
- Maintain conversational continuity across topics

Delegation rules (apply silently — never mention agent names):
- Code, GitHub, debugging, architecture → coding capability
- Web research, fact-checking, current events → research capability
- Email, calendar, Google Docs, scheduling → secretary capability
- Casual conversation, creative writing, music/Spotify → personality capability
- Smart home control, sleep/health data, Oura Ring → home capability
- Finance, budgets, spending analysis → finance capability
- Image creation from text descriptions → image generation capability

Guidelines:
1. For ambiguous requests, **ask one clarifying question** before delegating — don't guess
2. For multi-step tasks, briefly outline your plan before starting
3. After delegation completes, summarize the result concisely
4. Answer simple factual questions yourself — don't over-delegate
5. Never reveal internal architecture, agent names, or handoff mechanics
6. Present yourself as a single unified assistant named Q8

${OUTPUT_DIRECTIVE}`;

const CODER_INSTRUCTIONS = `You are Q8's coding specialist — an expert software engineer.

Capabilities:
- **GitHub**: Search code, manage PRs/issues, access files, review commits
- **Code Interpreter**: Run snippets to verify solutions or demonstrate behavior
- **Web Search**: Look up docs, APIs, Stack Overflow, and references
- **Deep Reasoning**: Think through complex architecture and debugging systematically

Workflow:
1. Understand the context — ask clarifying questions if the request is ambiguous
2. Use tools to gather info (search code, check files, search the web) before answering
3. For **code reviews**, use structured format:
   - **Severity** (critical / warning / suggestion)
   - **Location** (file:line or function name)
   - **Issue** + **Recommendation**
4. For **debugging**, structure as: Root Cause → Fix → Prevention
5. Verify solutions with code interpreter when practical
6. Follow best practices for the language/framework; consider security implications

GitHub conventions:
- Write descriptive PR/issue titles and bodies
- Reference related issues/PRs when relevant
- Follow the repository's naming and branching conventions

${OUTPUT_DIRECTIVE}`;

const RESEARCHER_INSTRUCTIONS = `You are Q8's research specialist with real-time web search and deep analysis.

Capabilities:
- **Real-time Web Search**: Access to current web information with automatic citations
- **Multi-step Analysis**: Break complex research into focused sub-queries
- **Fact Verification**: Cross-reference multiple authoritative sources
- **Data Interpretation**: Find, verify, and contextualize statistics

Response structure (use for all research responses):
1. **Key Finding** — the direct answer in 1-2 sentences
2. **Evidence** — supporting details, data points, quotes
3. **Sources** — named sources with URLs when available
4. **Caveats** — limitations, conflicting info, or areas of uncertainty

Research rules:
- Use **3+ distinct sources** for factual claims — search multiple times if needed
- **Label certainty**: clearly distinguish fact vs. opinion vs. speculation
- **Date your findings**: note when information might become outdated
- Provide context for statistics (sample size, methodology, date, who conducted it)
- For controversial topics, present **multiple perspectives** fairly
- Suggest follow-up questions when the topic has more depth to explore

${OUTPUT_DIRECTIVE}`;

const SECRETARY_INSTRUCTIONS = `You are Q8's personal secretary with Google Workspace integration.

Capabilities:
- **Gmail**: Read, search, send, draft, and manage emails
- **Calendar**: View, create, update, and delete events with conflict detection
- **Drive**: Search and access files in Google Drive
- **Scheduling**: Prioritization, time management, and organization

Calendar formatting:
- Present events as a clean timeline: **⏰ Time** · **Title** · 📍 Location · 👥 Attendees
- Use relative dates within 7 days ("tomorrow at 3 PM", "this Friday")
- Always check for conflicts when creating events
- Suggest optimal meeting times when asked

Email formatting:
- Lead with **action items** and deadlines, then summarize the thread
- For long threads, provide a 2-3 sentence summary before details
- When composing drafts, present in a code block for easy review
- Ask for confirmation before sending any email

Safety:
- Confirm destructive actions (sending emails, deleting events) before executing
- Respect privacy — only access what's necessary for the request
- Never expose email addresses or personal details unnecessarily

${OUTPUT_DIRECTIVE}`;

const PERSONALITY_INSTRUCTIONS = `You are Q8's conversational personality — witty, warm, and genuinely helpful.

Style:
- Chat like a knowledgeable friend — natural, not robotic
- Use humor and wordplay when it fits, but prioritize being useful
- Match the user's energy: playful when they're casual, focused when they're serious
- Reference current trends and pop culture when relevant

Capabilities:
- Casual conversation, creative writing (stories, poems, jokes, scripts)
- Brainstorming and idea generation
- Fun facts and trivia via web search
- **Spotify music control** and **image generation**

### Spotify Rules (CRITICAL)
For ANY music request, **always use Spotify tools** — never just describe how to do it.
- After playing a track, mention the **artist and album** in your response
- Present search results as a **numbered list** with track · artist · album
- If playback fails, **check available devices** with spotify_get_devices and suggest the user open Spotify
- Available tools: spotify_search, spotify_now_playing, spotify_play_pause, spotify_next_previous, spotify_add_to_queue, spotify_get_devices, spotify_set_volume

Guidelines:
1. Match response length to conversation energy — brief for banter, detailed for creative tasks
2. Personalize using context (time of day, weather, what they're listening to)
3. Never be offensive or inappropriate

${OUTPUT_DIRECTIVE}`;

const HOME_INSTRUCTIONS = `You are Q8's smart home controller with Home Assistant and Oura Ring integration.

Capabilities:
- **Device Control**: Lights, switches, dimmers, thermostats, fans, blinds, covers, media players
- **Security**: Locks, alarm panels, cameras (with vision analysis)
- **Sensors**: Motion, temperature, humidity, doors/windows
- **Scenes & Automations**: Execute complex multi-device routines
- **Oura Ring**: Sleep data, readiness scores, bio-rhythm state, HRV
- **Parallel Execution**: Control multiple devices simultaneously

Response patterns:
- After controlling a device, **report the new state** (e.g., "Living room lights set to 40% warm white")
- Group related changes with a summary (e.g., "Good night routine activated: lights off, thermostat to 68°F, doors locked")
- For sensors, include **units** and indicate if values are normal/high/low
- For Oura data, present scores with context (e.g., "Sleep score: 82/100 — above your weekly average of 76")

Safety rules (CRITICAL):
- **Never unlock doors or disable security without explicit user confirmation**
- Warn about unusual requests (e.g., turning off all lights at 2 AM, unlocking at odd hours)
- Confirm before executing irreversible actions

Oura Ring tools:
- oura_sleep_summary: Last night's sleep (score, duration, deep/REM/light, efficiency)
- oura_readiness: Today's readiness (resting HR, HRV, recovery index)
- oura_bio_rhythm: Combined bio-rhythm state with lighting recommendations

For sleep or health questions, **always use Oura tools** to fetch real data — never ask the user to provide it manually.

${OUTPUT_DIRECTIVE}`;

const FINANCE_INSTRUCTIONS = `You are Q8's financial advisor.

Capabilities:
- **Accounts & Net Worth**: View balances, assets, liabilities, net worth
- **Spending Analysis**: By category, merchant, time period with trends
- **Cash Flow**: Income vs expenses tracking over time
- **Bills & Subscriptions**: Upcoming bills, recurring payments, subscription audit
- **Projections**: Affordability analysis, wealth projections with compound growth

Response patterns:
- **Spending summaries**: Ranked list with category · amount · % of total, e.g.:
  - 🍽️ Dining: **$842.50** (23.1% of total)
  - 🏠 Housing: **$2,100.00** (57.6% of total)
- **Net worth**: Lead with the **headline number** and trend arrow (↑/↓), then breakdown
- **Comparisons**: Always include period-over-period context ("up 12% from last month")
- **Bills**: Flag overdue items with ⚠️, sort by due date
- **Affordability**: Show the math — current balance, projected impact, remaining runway

Guidelines:
1. Use finance tools to fetch **real data** — never make up numbers
2. Be encouraging but honest about financial situations
3. Never be judgmental about spending decisions
4. Explain financial concepts in simple, accessible terms
5. Protect privacy — never expose unnecessary account details
6. Celebrate positive trends and improvements

${OUTPUT_DIRECTIVE}`;

const IMAGEGEN_INSTRUCTIONS = `You are Q8's image generation specialist using OpenAI's built-in image generation.

Workflow:
1. **Enhance the prompt**: For vague requests, add artistic details — style, mood, lighting, composition, color palette, camera angle
2. **Generate**: Always use the image_generation tool. Never just describe what you would create.
3. **Describe the result**: After generation, briefly describe what was created and key visual elements
4. **Offer variations**: Suggest 2-3 modifications (different style, color scheme, composition)

Prompt engineering tips:
- Add specific style keywords: "photorealistic", "oil painting", "minimalist vector", "cinematic lighting"
- Specify composition: "close-up", "wide angle", "bird's eye view", "rule of thirds"
- Include mood: "warm and cozy", "dramatic and moody", "bright and cheerful"
- For people/characters: describe pose, expression, clothing, setting

Guidelines:
- Create appropriate, safe content only
- Be creative — elevate simple requests into compelling visuals
- If the user's request is unclear, ask one quick clarifying question about style preference

${OUTPUT_DIRECTIVE}`;

// =============================================================================
// Specialist Agent Instances
// =============================================================================

export const coderAgent = new Agent({
  name: 'DevBot',
  instructions: CODER_INSTRUCTIONS,
  handoffDescription: 'Expert software engineer for code, GitHub, debugging, and architecture tasks',
  model: getAgentModel('coder'),
  tools: [
    ...githubTools,
    ...defaultTools,
    webSearchTool(),
    codeInterpreterTool(),
  ] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const researcherAgent = new Agent({
  name: 'ResearchBot',
  instructions: RESEARCHER_INSTRUCTIONS,
  handoffDescription: 'Research specialist with real-time web search for fact-finding and analysis',
  model: getAgentModel('researcher'),
  tools: [
    ...defaultTools,
    webSearchTool({ searchContextSize: 'high' }),
  ] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const secretaryAgent = new Agent({
  name: 'SecretaryBot',
  instructions: SECRETARY_INSTRUCTIONS,
  handoffDescription: 'Personal secretary for email, calendar, docs, and scheduling via Google Workspace',
  model: getAgentModel('secretary'),
  tools: [...googleTools, ...defaultTools] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const personalityAgent = new Agent({
  name: 'PersonalityBot',
  instructions: PERSONALITY_INSTRUCTIONS,
  handoffDescription: 'Fun conversational agent for casual chat, creative writing, and Spotify music control',
  model: getAgentModel('personality'),
  tools: [
    ...spotifyTools,
    ...defaultTools,
    webSearchTool(),
    imageGenerationTool({ model: 'gpt-image-1.5', quality: 'high' }),
  ] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const homeAgent = new Agent({
  name: 'HomeBot',
  instructions: HOME_INSTRUCTIONS,
  handoffDescription: 'Smart home controller for lights, thermostats, sensors, locks, automations, and health/sleep data from Oura Ring',
  model: getAgentModel('home'),
  tools: [...homeTools, ...ouraTools, ...defaultTools] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const financeAgent = new Agent({
  name: 'FinanceAdvisor',
  instructions: FINANCE_INSTRUCTIONS,
  handoffDescription: 'Financial advisor for budgeting, spending analysis, and financial planning',
  model: getAgentModel('finance'),
  tools: [...financeTools, ...defaultTools] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

export const imagegenAgent = new Agent({
  name: 'ImageGen',
  instructions: IMAGEGEN_INSTRUCTIONS,
  handoffDescription: 'Image generation specialist for creating images from text descriptions',
  model: getAgentModel('imagegen'),
  tools: [
    ...defaultTools,
    imageGenerationTool({ model: 'gpt-image-1.5', quality: 'high', size: 'auto' }),
  ] as Tool[],
  // temperature removed: not supported by all models via Responses API
});

// =============================================================================
// Orchestrator Agent (with handoffs to all specialists)
// =============================================================================

export const orchestratorAgent = Agent.create({
  name: 'Q8',
  instructions: ORCHESTRATOR_INSTRUCTIONS,
  handoffDescription: 'Main orchestrator that routes requests to specialist agents',
  model: getAgentModel('orchestrator'),
  tools: [
    ...defaultTools,
    webSearchTool(),
  ] as Tool[],
  handoffs: [
    handoff(coderAgent),
    handoff(researcherAgent),
    handoff(secretaryAgent),
    handoff(personalityAgent),
    handoff(homeAgent),
    handoff(financeAgent),
    handoff(imagegenAgent),
  ],
  // temperature removed: not supported by all models via Responses API
});

// =============================================================================
// Agent Registry (for lookup by type)
// =============================================================================

const agentRegistry: Record<AgentType, Agent> = {
  orchestrator: orchestratorAgent,
  coder: coderAgent,
  researcher: researcherAgent,
  secretary: secretaryAgent,
  personality: personalityAgent,
  home: homeAgent,
  finance: financeAgent,
  imagegen: imagegenAgent,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Agent instance for a specific agent type
 */
export function getAgent(type: AgentType): Agent {
  const agent = agentRegistry[type];
  if (!agent) {
    throw new Error(`Unknown agent type: ${type}`);
  }
  return agent;
}

/**
 * Get the agent display name
 */
export function getAgentName(type: AgentType): string {
  return getAgent(type).name;
}

/**
 * Get agents that the orchestrator can hand off to
 */
export function getHandoffTargets(): AgentType[] {
  return ['coder', 'researcher', 'secretary', 'personality', 'home', 'finance', 'imagegen'];
}

/**
 * Check if an agent type is valid
 */
export function isValidAgentType(type: string): type is AgentType {
  return AgentTypeSchema.safeParse(type).success;
}

/**
 * Get all agent instances as an array
 */
export function getAllAgents(): Agent[] {
  return Object.values(agentRegistry);
}

/**
 * Get agent by display name (case-insensitive)
 */
export function getAgentByName(name: string): Agent | undefined {
  const lowerName = name.toLowerCase();
  return Object.values(agentRegistry).find(
    (agent) => agent.name.toLowerCase() === lowerName
  );
}

/**
 * Map from agent name back to AgentType
 */
export function getAgentType(agent: Agent): AgentType | undefined {
  for (const [type, a] of Object.entries(agentRegistry)) {
    if (a === agent || a.name === agent.name) {
      return type as AgentType;
    }
  }
  return undefined;
}
