import OpenAI from 'openai';
import type { ToolRegistry } from '../tools/registry.js';
import type { AgentOptions, AgentResponse, AgentContext } from './types.js';
import { GRAVITY_CLAW_SYSTEM_PROMPT } from './prompts.js';
import { logger } from '../utils/logger.js';
import { db } from '../memory/db.js';

export class Agent {
  private openai: OpenAI;
  private model: string;
  private maxIterations: number;
  private systemPrompt: string;
  private toolRegistry: ToolRegistry;

  constructor(options: AgentOptions, toolRegistry: ToolRegistry) {
    this.openai = new OpenAI({
      apiKey: options.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': options.siteUrl ?? 'https://github.com/gravity-claw',
        'X-Title': options.siteName ?? 'Gravity Claw',
      },
    });
    this.model = options.model;
    this.maxIterations = options.maxIterations ?? 10;
    this.systemPrompt = options.systemPrompt ?? GRAVITY_CLAW_SYSTEM_PROMPT;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Runs an agentic conversation loop for a user query via OpenRouter.
   * Allows multi-step tool execution until the model finishes or the max iteration limit is reached.
   */
  async run(userQuery: string, context: AgentContext): Promise<AgentResponse> {
    // 1. Fetch recent episodic memory
    const recentHistory = db.getRecentEpisodicMemory(context.userId, 10);
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.systemPrompt + `\n\nYour user ID is ${context.userId}.`,
      }
    ];

    // Inject history
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Add current query
    messages.push({
      role: 'user',
      content: userQuery,
    });

    const tools = this.toolRegistry.getOpenAITools();
    const toolsUsed: string[] = [];
    let iterations = 0;
    let finalAnswer = '';

    logger.info(`Agent query started: "${userQuery.slice(0, 80)}${userQuery.length > 80 ? '...' : ''}"`);

    while (iterations < this.maxIterations) {
      iterations++;
      logger.debug(`Agent iteration ${iterations}/${this.maxIterations} using model: ${this.model}`);

      let response: OpenAI.ChatCompletion;
      try {
        response = await this.openai.chat.completions.create({
          model: this.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`OpenRouter API call error: ${errorMsg}`);
        throw new Error(`Failed to communicate with OpenRouter API: ${errorMsg}`);
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('Received empty response from OpenRouter API.');
      }

      const assistantMessage = choice.message;

      // Check if model requested tool execution
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant's message containing tool_calls to history
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') {
            continue;
          }

          const toolName = toolCall.function.name;
          logger.info(`Agent calling tool: "${toolName}" (ID: ${toolCall.id})`);

          if (!toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
          }

          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = toolCall.function.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};
          } catch (parseErr) {
            logger.warn(`Failed to parse arguments for tool "${toolName}":`, parseErr);
          }

          const toolResult = await this.toolRegistry.execute(toolName, parsedArgs);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // Continue agentic loop to allow model to evaluate tool results
        continue;
      }

      // If no more tool calls, obtain final text response
      finalAnswer = assistantMessage.content || '';
      break;
    }

    if (iterations >= this.maxIterations && !finalAnswer) {
      finalAnswer = `⚠️ Agent reached the maximum tool execution limit (${this.maxIterations} iterations) without concluding.`;
      logger.warn(`Agent hit max iterations (${this.maxIterations}) for query`);
    }

    logger.info(`Agent run completed in ${iterations} iteration(s). Tools used: [${toolsUsed.join(', ')}]`);

    const responseText = finalAnswer || 'I processed your request, but have no text response to show.';

    // 2. Save episodic memory for this turn
    try {
      // Don't save the internal system event trigger as a user query
      if (!userQuery.startsWith('[SYSTEM EVENT]')) {
        db.addEpisodicMessage({ user_id: context.userId, role: 'user', content: userQuery });
      }
      
      // If the agent responded with NO_UPDATE to a system event, don't save the response either
      if (!(userQuery.startsWith('[SYSTEM EVENT]') && responseText === 'NO_UPDATE')) {
        db.addEpisodicMessage({ user_id: context.userId, role: 'assistant', content: responseText });
      }
    } catch (err) {
      logger.error('Failed to save episodic memory:', err);
    }

    return {
      text: responseText,
      iterations,
      toolsUsed,
    };
  }
}

