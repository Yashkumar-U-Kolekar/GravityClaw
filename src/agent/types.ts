export interface AgentOptions {
  apiKey: string;
  model: string;
  maxIterations?: number;
  systemPrompt?: string;
  siteUrl?: string;
  siteName?: string;
}

export interface AgentContext {
  userId: number;
  chatId?: number;
  messageId?: number;
}

export interface AgentResponse {
  text: string;
  iterations: number;
  toolsUsed: string[];
}

