/**
 * Direct API Tool Implementations
 * Each tool calls APIs directly without MCP proxy layer
 *
 * All tools use @openai/agents tool() for native SDK integration.
 */

// Re-export types for use in agent definitions and runner
export type { Tool, FunctionTool } from '@openai/agents';

// Default tools available to all agents
export * from './default';

// Spotify tools for Personality agent
export * from './spotify';

// GitHub tools for Coder agent
export * from './github';

// Google Workspace tools for Secretary agent
export * from './google';

// Home Assistant tools for Home agent
export * from './home';

// Finance tools for Finance agent
export * from './finance';

// NOTE: Image generation uses hosted imageGenerationTool() from @openai/agents.
// Custom image tools (generate_image, edit_image, analyze_image) removed — they
// depended on the legacy image-executor which has been deleted.

// Oura Ring tools for Home agent
export * from './oura';
