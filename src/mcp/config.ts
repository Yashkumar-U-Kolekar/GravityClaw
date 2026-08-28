import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

export const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

export const mcpConfigSchema = z.object({
  mcpServers: z.record(mcpServerSchema).default({}),
});

export type McpServerConfig = z.infer<typeof mcpServerSchema>;
export type McpConfig = z.infer<typeof mcpConfigSchema>;

export function loadMcpConfig(configPath: string = 'mcp.json'): McpConfig {
  const resolvedPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(resolvedPath)) {
    logger.debug(`No MCP config found at ${resolvedPath}. Initializing with empty MCP configuration.`);
    return { mcpServers: {} };
  }

  try {
    const fileContents = fs.readFileSync(resolvedPath, 'utf-8');
    const parsedJson = JSON.parse(fileContents);
    
    const result = mcpConfigSchema.safeParse(parsedJson);
    if (!result.success) {
      logger.error('Invalid mcp.json format:');
      for (const issue of result.error.issues) {
        logger.error(`  - [${issue.path.join('.')}] ${issue.message}`);
      }
      return { mcpServers: {} };
    }

    return result.data;
  } catch (err) {
    logger.error(`Failed to read or parse ${configPath}:`, err);
    return { mcpServers: {} };
  }
}
