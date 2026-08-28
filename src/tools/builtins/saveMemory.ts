import type { ToolDefinition } from '../types.js';
import { db } from '../../memory/db.js';

interface SaveMemoryInput {
  userId: number;
  fact: string;
}

export const saveMemoryTool: ToolDefinition<SaveMemoryInput, { status: string }> = {
  name: 'save_memory',
  description:
    'Saves a specific fact, preference, or important context about the user to long-term semantic memory. Use this proactively when the user tells you something you should remember for future conversations.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'number',
        description: 'The numerical ID of the user (available in your system context).',
      },
      fact: {
        type: 'string',
        description: 'The concise fact to save (e.g., "User is allergic to peanuts", "User lives in Berlin").',
      },
    },
    required: ['userId', 'fact'],
  },
  execute: (input) => {
    db.saveSemanticFact(input.userId, input.fact);
    return { status: 'Memory saved successfully.' };
  },
};
