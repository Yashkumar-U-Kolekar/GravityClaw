import type { ToolRegistry } from '../tools/registry.js';
import type { ToolDefinition } from '../tools/types.js';
import { loadMcpConfig } from './config.js';
import { McpClientConnection } from './client.js';
import { logger } from '../utils/logger.js';

export class McpBridge {
  private clients = new Map<string, McpClientConnection>();

  constructor(private toolRegistry: ToolRegistry) {}

  async initialize(): Promise<void> {
    const config = loadMcpConfig();
    const serverNames = Object.keys(config.mcpServers);

    if (serverNames.length === 0) {
      logger.info('No MCP servers configured in mcp.json.');
      return;
    }

    logger.info(`Found ${serverNames.length} MCP server(s) in configuration.`);

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      const client = new McpClientConnection(serverName, serverConfig);
      try {
        await client.connect();
        this.clients.set(serverName, client);

        // Fetch and register tools from this server
        const mcpTools = await client.getTools();
        logger.info(`Loaded ${mcpTools.length} tools from MCP Server [${serverName}].`);

        for (const mcpTool of mcpTools) {
          // Namespace the tool to prevent naming collisions
          const namespacedName = `mcp_${serverName}_${mcpTool.name}`;
          
          const toolDef: ToolDefinition<any, any> = {
            name: namespacedName,
            description: `[MCP: ${serverName}] ${mcpTool.description || 'No description provided'}`,
            inputSchema: mcpTool.inputSchema as any, // MCP types perfectly map to JSON Schema
            execute: async (inputArgs) => {
              const result = await client.callTool(mcpTool.name, inputArgs);
              // MCP tools return an array of contents. We join them for the agent.
              if (Array.isArray(result)) {
                return result.map((r: any) => {
                  if (r.type === 'text') return r.text;
                  return JSON.stringify(r);
                }).join('\n');
              }
              return result;
            },
          };

          this.toolRegistry.register(toolDef);
        }
      } catch (err) {
        logger.error(`Skipping MCP server [${serverName}] due to initialization failure.`);
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.close();
    }
  }
}
