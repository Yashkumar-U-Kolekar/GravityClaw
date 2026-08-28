import { Bot } from 'grammy';
import type { EnvConfig } from '../config/env.js';
import type { Agent } from '../agent/agent.js';
import type { ToolRegistry } from '../tools/registry.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createMessageHandler } from './handlers/message.js';
import { logger } from '../utils/logger.js';

export function createTelegramBot(
  config: EnvConfig,
  agent: Agent,
  toolRegistry: ToolRegistry
): Bot {
  const bot = new Bot(config.telegramBotToken);

  // 1. Enforce Whitelist Security Middleware across all updates
  bot.use(createAuthMiddleware(config.allowedUserIds));

  // 2. Built-in Commands
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🤖 *Gravity Claw is online and ready.*\n\n' +
      'I am your private, local-first AI assistant powered by OpenRouter. Send me any prompt or question to get started!',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', async (ctx) => {
    const tools = toolRegistry.getToolNames().map((name) => `• \`${name}\``).join('\n') || 'None';
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    await ctx.reply(
      `📊 *Gravity Claw Status*\n\n` +
      `• *Provider:* \`OpenRouter\`\n` +
      `• *Model:* \`${config.openrouterModel}\`\n` +
      `• *Max Tool Iterations:* \`${config.maxAgentIterations}\`\n` +
      `• *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
      `• *Registered Tools (${toolRegistry.count}):*\n${tools}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'ℹ️ *Gravity Claw Help*\n\n' +
      'Commands:\n' +
      '• `/status` - View bot configuration and registered tools\n' +
      '• `/help` - View available commands\n\n' +
      'Just send me a message and I will assist you with autonomous tool execution!',
      { parse_mode: 'Markdown' }
    );
  });

  // 3. Register Message Handler for general conversation
  bot.on('message:text', createMessageHandler(agent));

  // 4. Global Error Handler
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
  });

  return bot;
}
