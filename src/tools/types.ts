import type OpenAI from 'openai';

/**
 * JSON Schema definition for tool inputs matching standard JSON Schema specification.
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: Record<string, unknown>;
    default?: unknown;
  }>;
  required?: string[];
}

/**
 * Core interface for all Gravity Claw tools.
 */
export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}

/**
 * Helper to convert ToolDefinition to OpenAI/OpenRouter ChatCompletionTool format.
 */
export function toOpenAITool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as unknown as Record<string, unknown>,
    },
  };
}
