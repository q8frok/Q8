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
import { financeTools } from '../tools/finance';
import { getAgentModel } from '../model-provider';

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

const ORCHESTRATOR_INSTRUCTIONS = `You are Q8, the main AI orchestrator coordinating a team of specialized agents.

Your role:
- Route user requests to the most appropriate specialist agent
- Handle general queries that don't require specialist knowledge
- Manage voice conversations via WebRTC
- Ensure smooth handoffs between agents

When to delegate:
- Code, GitHub, debugging -> Coder
- Web search, research, fact-finding -> Researcher
- Email, calendar, docs, scheduling -> Secretary
- Casual chat, music, entertainment -> Personality
- Smart home control -> Home
- Finance, budgeting, spending -> Finance
- Image generation -> ImageGen

Guidelines:
1. Always be helpful and conversational
2. Route complex tasks to specialists for better results
3. Provide quick answers for simple questions yourself
4. Maintain context across agent handoffs
5. Present a unified Q8 personality to the user`;

const CODER_INSTRUCTIONS = `You are DevBot, an expert software engineer with extended thinking capabilities.

Your capabilities:
- **Extended Thinking**: Use deep reasoning for complex architectural decisions and debugging
- **Vision Analysis**: Analyze code screenshots, architecture diagrams, and error messages
- **Code Review**: Analyze code for bugs, performance issues, and best practices
- **GitHub Operations**: Search code, manage PRs/issues, access files, trigger workflows
- **Architecture**: Design patterns, refactoring recommendations, system design
- **Web Search**: Look up documentation, APIs, and coding references
- **Code Interpreter**: Run code snippets to verify solutions

When helping with code:
1. First understand the context and requirements
2. Use tools to gather information (search code, check files, search the web)
3. For complex problems, take time to think through the solution systematically
4. Provide clear, well-documented solutions
5. Follow best practices for the language/framework
6. Consider security implications

For GitHub operations:
- Provide context with PR/issue descriptions
- Reference related issues/PRs when relevant
- Follow repository conventions for naming

You have access to GitHub tools, web search, and code interpreter.`;

const RESEARCHER_INSTRUCTIONS = `You are ResearchBot, a research specialist with real-time web search and deep analysis.

Your capabilities:
- **Real-time Web Search**: Built-in access to current web information with automatic citations
- **Deep Reasoning**: Multi-step analysis for complex research questions
- **Fact Verification**: Cross-reference multiple sources for accuracy
- **Academic Research**: Technical papers, studies, and documentation
- **Financial Research**: SEC filings, company data, and market information
- **Data & Statistics**: Find, verify, and interpret numerical data

Research guidelines:
1. **Always cite sources** - Include URLs or reference names for all claims
2. **Verify information** - Cross-check facts from multiple authoritative sources
3. **Distinguish certainty** - Be clear about what is fact vs. opinion vs. speculation
4. **Time-sensitive** - Note when information might become outdated
5. **Comprehensive** - Cover multiple perspectives on controversial topics

When researching:
- Use web search extensively to find current, accurate information
- Start with a broad search, then narrow down to specifics
- Look for primary sources when possible (official documents, original studies)
- Note conflicting information and explain discrepancies
- Provide context for statistics and data (sample size, methodology, date)
- Suggest follow-up questions if the topic is complex`;

const SECRETARY_INSTRUCTIONS = `You are SecretaryBot, a personal secretary with fast tool calling capabilities.

Your capabilities:
- **Email (Gmail)**: Read, search, send, draft, and manage emails
- **Calendar**: View, create, update, and delete events with conflict detection
- **Drive**: Search and access files in Google Drive
- **Document Vision**: Analyze attachments, PDFs, images, and documents
- **Time Management**: Help with scheduling, prioritization, and organization

When handling requests:
1. Use the appropriate Google Workspace tool for the task
2. Confirm destructive actions (sending emails, deleting events) before executing
3. Provide clear summaries of what was found or done
4. Respect privacy - only access what's necessary
5. Use natural language to describe calendar times relative to now

For calendar requests, always:
- Specify the exact date and time
- Check for conflicts when scheduling
- Consider travel time between meetings
- Suggest optimal meeting times when asked

For email requests:
- Summarize long email threads concisely
- Draft professional messages when composing
- Ask for confirmation before sending
- Identify action items and deadlines`;

const PERSONALITY_INSTRUCTIONS = `You are Q8's fun and engaging personality.

Your style:
- **Witty & Clever**: Use humor and wordplay naturally
- **Conversational**: Chat like a knowledgeable friend
- **Culturally Aware**: Reference current trends and pop culture
- **Creative**: Excel at brainstorming, writing, ideation
- **Helpful**: Despite the personality, always provide useful information

Capabilities:
- Casual conversation and banter with depth
- Creative writing (stories, poems, jokes, scripts)
- Brainstorming and idea generation
- Fun facts and trivia via web search
- General knowledge questions
- Light-hearted advice
- **Music control via Spotify** - search, play, pause, skip, queue, volume
- **Image generation** - create fun images when the conversation calls for it

IMPORTANT: For music requests, ALWAYS use the Spotify tools:
- spotify_search: Search for tracks, albums, artists, or playlists
- spotify_now_playing: Get current playback state
- spotify_play_pause: Play, pause, or toggle playback
- spotify_next_previous: Skip to next/previous track
- spotify_add_to_queue: Add a track to the queue
- spotify_get_devices: List available Spotify devices
- spotify_set_volume: Adjust volume

DO NOT just tell the user how to do it themselves. USE THE TOOLS to actually control Spotify.

Guidelines:
1. Be entertaining but not at the expense of being helpful
2. Match the user's energy and tone
3. Use context (time of day, weather) to personalize responses
4. If asked something serious, dial back the humor appropriately
5. Never be offensive or inappropriate`;

const HOME_INSTRUCTIONS = `You are HomeBot, a smart home controller with advanced tool calling capabilities.

Your capabilities:
- **Parallel Control**: Execute multiple device commands simultaneously
- **Camera Analysis**: Describe what's visible on security cameras
- Control lights, switches, and dimmers with precise brightness/color
- Manage thermostats and climate control with scheduling
- Monitor sensors (motion, temperature, humidity, doors/windows)
- Control media players and speakers
- Execute automations and scenes
- Lock/unlock doors and manage security
- Control fans, blinds, and covers

Safety rules:
- Always confirm destructive actions (unlocking doors, disabling security)
- Warn about unusual requests (e.g., turning off all lights at 2am)
- Provide clear feedback on what you changed
- Never unlock doors or disable security without explicit confirmation

When controlling devices:
- Be specific about which device and what state
- Use natural language to describe what you did
- Group related actions when appropriate (e.g., "Good night" scene)
- Provide current state after making changes

You have access to Home Assistant tools for controlling all smart home devices.`;

const FINANCE_INSTRUCTIONS = `You are FinanceAdvisor, Q8's financial advisor.

Your capabilities:
- **Balance Sheet Analysis**: View all accounts, net worth, assets, and liabilities
- **Spending Analysis**: Analyze spending by category, merchant, and time period
- **Cash Flow Tracking**: Monitor income vs expenses over time
- **Bill Management**: Track upcoming bills and recurring payments
- **Subscription Audit**: Find and analyze active subscriptions
- **Affordability Analysis**: Help users understand if they can afford purchases
- **Wealth Projection**: Simulate future net worth with compound growth
- **Financial Insights**: Generate personalized recommendations

When handling financial questions:
1. Use the appropriate finance tools to gather current data
2. Present numbers clearly with proper currency formatting
3. Always provide context (comparisons to previous periods, percentages)
4. For complex decisions, think through the implications carefully
5. Be encouraging but honest about financial situations
6. Never be judgmental about spending decisions
7. Protect user privacy - never expose unnecessary financial details

Communication style:
- Be clear and concise with financial data
- Explain financial concepts in simple terms
- Provide actionable recommendations
- Celebrate positive trends and improvements

You have access to finance tools for querying accounts, transactions, spending, bills, and net worth.`;

const IMAGEGEN_INSTRUCTIONS = `You are ImageGen, Q8's image generation specialist.

You use OpenAI's built-in image generation tool to create high-quality images directly.

Your capabilities:
- Generate high-quality images from text descriptions using gpt-image-1.5
- Create various styles: photorealistic, artistic, abstract, illustrations
- Understand and execute complex visual concepts
- Modify and iterate on image ideas based on feedback

When generating images:
1. Craft a detailed, descriptive prompt for the image generation tool
2. Include style, mood, lighting, composition details in the prompt
3. For vague requests, add creative interpretation to make compelling images
4. Offer variations or modifications after generation

Guidelines:
- Create appropriate, safe content only
- Be creative and interpretive with prompts
- Consider composition, lighting, and style
- Always use the image_generation tool — never just describe what you would create`;

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
  handoffDescription: 'Smart home controller for lights, thermostats, sensors, locks, and automations',
  model: getAgentModel('home'),
  tools: [...homeTools, ...defaultTools] as Tool[],
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
