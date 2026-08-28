import type { ToolDefinition } from '../types.js';
import { db } from '../../memory/db.js';

interface SearchMemoryInput {
  userId: number;
  query: string;
}

export const searchMemoryTool: ToolDefinition<SearchMemoryInput, { results: string[] }> = {
  name: 'search_memory',
  description:
    'Searches long-term semantic memory for facts or context related to the user. Use this when the user asks about something they previously told you, or to recall preferences.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'number',
        description: 'The numerical ID of the user (available in your system context).',
      },
      query: {
        type: 'string',
        description: 'The keyword or phrase to search for (e.g., "favorite color", "Berlin").',
      },
    },
    required: ['userId', 'query'],
  },
  execute: (input) => {
    const results = db.searchSemanticMemory(input.userId, input.query);
    return { results };
  },
};
