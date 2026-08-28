import type { Context } from 'grammy';
import type { Agent } from '../../agent/agent.js';
import { logger } from '../../utils/logger.js';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;

/**
 * Splits long text into chunks that fit within Telegram's message limits.
 */
function splitMessage(text: string, maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  const lines = text.split('\n');

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If a single line is longer than maxLength, slice it hard
      if (line.length > maxLength) {
        let remaining = line;
        while (remaining.length > maxLength) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        currentChunk = remaining;
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Sends a message to the user safely, trying Markdown first and falling back to plain text.
 */
async function sendSafeMessage(ctx: Context, text: string): Promise<void> {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, { parse_mode: 'Markdown' });
    } catch {
      // If Markdown formatting fails (unbalanced markdown tokens), fall back to plain text
      try {
        await ctx.reply(chunk);
      } catch (err) {
        logger.error('Failed to send Telegram message:', err);
      }
    }
  }
}

/**
 * Handles incoming text messages from authenticated users.
 */
export function createMessageHandler(agent: Agent) {
  return async (ctx: Context): Promise<void> => {
    const text = ctx.message?.text;
    const userId = ctx.from?.id;

    if (!text || !userId) {
      return;
    }

    logger.info(`Received message from user ${userId}: "${text.slice(0, 60)}"`);

    // Keep sending 'typing' chat action every 4 seconds while the agent is running
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => {
        // Ignore typing errors if context expires
      });
    }, 4000);

    // Trigger initial typing action immediately
    ctx.replyWithChatAction('typing').catch(() => {});

    try {
      const response = await agent.run(text, { userId });
      clearInterval(typingInterval);

      await sendSafeMessage(ctx, response.text);
    } catch (err: unknown) {
      clearInterval(typingInterval);
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error handling user message:', errorMessage);
      await sendSafeMessage(
        ctx,
        `❌ *Error processing request:*\n\`${errorMessage}\``
      );
    }
  };
}
