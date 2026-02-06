/**
 * Image Generation & Analysis Tools
 * Wraps the existing executeImageTool() executor for SDK integration
 * Assigned to: ImageGen Agent (GPT-Image-1.5)
 *
 * Uses @openai/agents tool() for native SDK integration.
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import { executeImageTool } from '../../tools/image-executor';

// =============================================================================
// generate_image
// =============================================================================

const generateImageSchema = z.object({
  prompt: z.string().describe('Detailed description of the image to generate'),
  style: z.enum([
    'photo', 'illustration', 'diagram', 'chart', 'infographic',
    'artistic', 'technical', 'sketch', 'watercolor', '3d_render',
  ]).nullable().describe('Visual style for the generated image'),
  aspect_ratio: z.enum([
    '1:1', '16:9', '9:16', '4:3', '3:4', '21:9',
    'square', 'landscape', 'portrait',
  ]).nullable().describe('Aspect ratio of the output image'),
  quality: z.enum(['hd', 'standard', 'fast']).default('hd').describe('Quality level (default: hd)'),
  negative_prompt: z.string().nullable().describe('Elements to avoid in the generation'),
});

export const generateImageTool = tool({
  name: 'generate_image',
  description: 'Generate an image from a text description. Supports multiple styles and aspect ratios. Returns base64 image data.',
  parameters: generateImageSchema,
  execute: async (args) => {
    const result = await executeImageTool('generate_image', args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// edit_image
// =============================================================================

const editImageSchema = z.object({
  image_url: z.string().describe('URL of the image to edit'),
  instruction: z.string().describe('Description of how to edit the image'),
  preserve_style: z.boolean().default(true).describe('Preserve the original style while editing'),
  mask_description: z.string().nullable().describe('Description of the area to focus edits on'),
});

export const editImageTool = tool({
  name: 'edit_image',
  description: 'Edit or modify an existing image based on text instructions. Provide the image URL and describe the desired changes.',
  parameters: editImageSchema,
  execute: async (args) => {
    const result = await executeImageTool('edit_image', args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// analyze_image
// =============================================================================

const analyzeImageSchema = z.object({
  image_url: z.string().describe('URL of the image to analyze'),
  analysis_type: z.enum([
    'general', 'detailed', 'text_extraction', 'diagram_interpretation',
    'chart_data', 'accessibility', 'technical', 'artistic',
  ]).default('general').describe('Type of analysis to perform'),
  questions: z.array(z.string()).nullable().describe('Specific questions to answer about the image'),
  extract_structured_data: z.boolean().nullable().describe('Try to extract structured data (tables, charts) as JSON'),
});

export const analyzeImageTool = tool({
  name: 'analyze_image',
  description: 'Analyze image content using vision. Supports general description, text extraction (OCR), diagram interpretation, chart data extraction, and more.',
  parameters: analyzeImageSchema,
  execute: async (args) => {
    const result = await executeImageTool('analyze_image', args);
    return JSON.stringify(result);
  },
});

// =============================================================================
// Export all Image tools
// =============================================================================

export const imageTools: Tool[] = [
  generateImageTool,
  editImageTool,
  analyzeImageTool,
];
