import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpServerConfig } from './config.js';
import { logger } from '../utils/logger.js';

export class McpClientConnection {
  private client: Client;
  private transport?: StdioClientTransport;
  public readonly serverName: string;
  private isConnected: boolean = false;

  constructor(serverName: string, private config: McpServerConfig) {
    this.serverName = serverName;
    this.client = new Client(
      {
        name: 'GravityClaw',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(): Promise<void> {
    logger.debug(`Starting MCP server [${this.serverName}]: ${this.config.command} ${this.config.args.join(' ')}`);
    
    // Filter out undefined env vars from process.env
    const safeProcessEnv = Object.fromEntries(
      Object.entries(process.env).filter(([_, v]) => v !== undefined)
    ) as Record<string, string>;

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: {
        ...safeProcessEnv,
        ...(this.config.env || {}),
      },
    });

    try {
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info(`MCP Server [${this.serverName}] connected successfully.`);
    } catch (err) {
      logger.error(`Failed to connect to MCP Server [${this.serverName}]:`, err);
      throw err;
    }
  }

  async getTools(): Promise<Tool[]> {
    if (!this.isConnected) {
      throw new Error(`Cannot get tools from [${this.serverName}] because it is not connected.`);
    }

    try {
      const response = await this.client.listTools();
      return response.tools;
    } catch (err) {
      logger.error(`Failed to list tools from MCP Server [${this.serverName}]:`, err);
      return [];
    }
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<any> {
    if (!this.isConnected) {
      throw new Error(`Cannot call tool ${toolName} on [${this.serverName}] because it is not connected.`);
    }

    logger.debug(`Calling MCP tool [${this.serverName}::${toolName}] with args:`, args);
    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });
      return response.content;
    } catch (err) {
      logger.error(`Failed to call MCP tool [${this.serverName}::${toolName}]:`, err);
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.isConnected && this.transport) {
      logger.info(`Closing MCP Server [${this.serverName}] connection...`);
      try {
        await this.transport.close();
      } catch (err) {
        logger.error(`Error closing MCP Server [${this.serverName}]:`, err);
      }
      this.isConnected = false;
    }
  }
}
