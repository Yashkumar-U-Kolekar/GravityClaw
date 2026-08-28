import type OpenAI from 'openai';
import { type ToolDefinition, toOpenAITool } from './types.js';
import { logger } from '../utils/logger.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition<any, any>>();

  /**
   * Register a new tool in the registry.
   */
  register(tool: ToolDefinition<any, any>): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Returns all registered tools formatted for OpenAI/OpenRouter Chat Completions API.
   */
  getOpenAITools(): OpenAI.ChatCompletionTool[] {
    return Array.from(this.tools.values()).map(toOpenAITool);
  }

  /**
   * Returns all registered tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Checks if a tool with the given name is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Safely executes a registered tool by name with input parameters.
   * Catches runtime exceptions and returns a structured error object rather than throwing.
   */
  async execute(name: string, input: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);

    if (!tool) {
      const errorMsg = `Error: Tool "${name}" is not registered. Available tools: ${Array.from(this.tools.keys()).join(', ')}`;
      logger.error(errorMsg);
      return JSON.stringify({ error: errorMsg });
    }

    try {
      logger.debug(`Executing tool "${name}" with input:`, input);
      const result = await tool.execute(input);
      logger.debug(`Tool "${name}" executed successfully`);
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error executing tool "${name}":`, errorMessage);
      return JSON.stringify({ error: `Tool execution failed: ${errorMessage}` });
    }
  }

  /**
   * Returns the count of registered tools.
   */
  get count(): number {
    return this.tools.size;
  }
}
