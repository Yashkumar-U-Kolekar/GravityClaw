import { loadConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { ToolRegistry } from './tools/registry.js';
import { getCurrentTimeTool } from './tools/builtins/getCurrentTime.js';
import { saveMemoryTool } from './tools/builtins/saveMemory.js';
import { searchMemoryTool } from './tools/builtins/searchMemory.js';
import { McpBridge } from './mcp/bridge.js';
import { Agent } from './agent/agent.js';
import { HeartbeatManager } from './agent/heartbeat.js';
import { createTelegramBot } from './bot/telegram.js';
import { db } from './memory/db.js';

async function bootstrap() {
  console.log(`
  ======================================================
     ____                 _ _           ____ _                 
    / ___|_ __ __ ___   _(_) |_ _   _  / ___| | __ ___      __ 
   | |  _| '__/ _\` \\ \\ / / | __| | | || |   | |/ _\` \\ \\ /\\ / / 
   | |_| | | | (_| |\\ V /| | |_| |_| || |___| | (_| |\\ V  V /  
    \\____|_|  \\__,_| \\_/ |_|\\__|\\__, | \\____|_|\\__,_| \\_/\\_/   
                                |___/                          
  ======================================================
  [Level 5: Heartbeat - Proactive Autonomous Agent]
  `);

  // 1. Load and validate environment configuration
  const config = loadConfig();
  logger.info(`Configuration loaded successfully.`);
  logger.info(`LLM Provider: OpenRouter (https://openrouter.ai/api/v1)`);
  logger.info(`OpenRouter Model: ${config.openrouterModel}`);
  logger.info(`Whitelist configured for ${config.allowedUserIds.size} user ID(s).`);

  // 2. Initialize Tool Registry and register built-in tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(getCurrentTimeTool);
  toolRegistry.register(saveMemoryTool);
  toolRegistry.register(searchMemoryTool);
  logger.info(`Initialized ToolRegistry with ${toolRegistry.count} built-in tool(s).`);

  // 3. Initialize MCP Bridge
  const mcpBridge = new McpBridge(toolRegistry);
  await mcpBridge.initialize();

  // 4. Initialize Agent Loop
  const agent = new Agent(
    {
      apiKey: config.openrouterApiKey,
      model: config.openrouterModel,
      maxIterations: config.maxAgentIterations,
    },
    toolRegistry
  );

  // 5. Initialize Telegram Bot with Long Polling (No open ports)
  const bot = createTelegramBot(config, agent, toolRegistry);

  // 6. Initialize Heartbeat Manager
  const heartbeatManager = new HeartbeatManager(bot, agent, config.allowedUserIds, config.heartbeatIntervalMinutes);

  // 7. Handle Graceful Shutdown
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Shutting down Gravity Claw gracefully...`);
    try {
      heartbeatManager.stop();
      await bot.stop();
      logger.info('Telegram polling stopped.');
      await mcpBridge.closeAll();
      db.close();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // 8. Start Bot via Long-Polling
  logger.info('Connecting to Telegram via long-polling (no web server exposed)...');
  await bot.start({
    onStart: (botInfo) => {
      logger.info(`Gravity Claw bot @${botInfo.username} is now online and listening for messages.`);
      // Start proactive heartbeat after bot successfully connects
      heartbeatManager.start();
    },
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal error during startup:', err);
  process.exit(1);
});
