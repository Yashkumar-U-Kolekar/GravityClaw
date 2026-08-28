import type { Context, MiddlewareFn, NextFunction } from 'grammy';
import { logger } from '../../utils/logger.js';

/**
 * Security Middleware: User ID Whitelist
 * Silently drops any message or update originating from an unauthorized Telegram user ID.
 * Never leaks bot presence, response, or configuration to unauthenticated users.
 */
export function createAuthMiddleware(allowedUserIds: Set<number>): MiddlewareFn<Context> {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const senderId = ctx.from?.id;

    if (!senderId || !allowedUserIds.has(senderId)) {
      // Security by default: Silently drop without responding
      logger.warn(
        `[SECURITY] Dropped unauthorized request from user ID: ${senderId ?? 'Unknown'} (Username: @${ctx.from?.username ?? 'none'})`
      );
      return;
    }

    // Authorized user - continue processing
    await next();
  };
}
