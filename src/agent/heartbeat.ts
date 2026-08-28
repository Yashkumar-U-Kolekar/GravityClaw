import type { Bot } from 'grammy';
import type { Agent } from './agent.js';
import { logger } from '../utils/logger.js';

export class HeartbeatManager {
  private intervalId?: NodeJS.Timeout;

  constructor(
    private bot: Bot,
    private agent: Agent,
    private allowedUserIds: Set<number>,
    private intervalMinutes: number
  ) {}

  start() {
    if (this.intervalId) {
      return;
    }
    const ms = this.intervalMinutes * 60 * 1000;
    logger.info(`Starting proactive heartbeat manager. Interval: ${this.intervalMinutes} minute(s).`);
    
    // We don't want to block the start function, so we run the interval async
    this.intervalId = setInterval(() => {
      this.runHeartbeat().catch((err) => {
        logger.error('Error during heartbeat loop:', err);
      });
    }, ms);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Heartbeat manager stopped.');
    }
  }

  private async runHeartbeat() {
    logger.debug('Waking up for proactive heartbeat...');
    for (const userId of this.allowedUserIds) {
      try {
        const prompt = `[SYSTEM EVENT] It is time for a proactive heartbeat. 
Review your recent memories and context. If you have an important update, briefing, or reminder for the user, provide it now.
If there is NOTHING urgent or meaningful to report, you MUST respond with the exact text: "NO_UPDATE".
Do not say "I have no updates", just output exactly "NO_UPDATE".`;

        const response = await this.agent.run(prompt, { userId });
        
        if (response.text.trim() !== 'NO_UPDATE') {
          logger.info(`Proactive message generated for user ${userId}. Sending...`);
          await this.bot.api.sendMessage(userId, response.text);
        } else {
          logger.debug(`No proactive update needed for user ${userId}.`);
        }
      } catch (err) {
        logger.error(`Failed to run heartbeat for user ${userId}:`, err);
      }
    }
  }
}
