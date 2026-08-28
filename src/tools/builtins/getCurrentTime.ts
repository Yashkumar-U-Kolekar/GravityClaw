import type { ToolDefinition } from '../types.js';

interface GetCurrentTimeInput {
  timeZone?: string;
}

interface GetCurrentTimeOutput {
  iso: string;
  formatted: string;
  timeZone: string;
  dayOfWeek: string;
  unixTimestamp: number;
}

export const getCurrentTimeTool: ToolDefinition<GetCurrentTimeInput, GetCurrentTimeOutput> = {
  name: 'get_current_time',
  description:
    'Retrieves the current date, time, day of the week, and timezone. Can be queried for any IANA timezone (e.g., "America/New_York", "Europe/London", "Asia/Tokyo", "UTC"). Defaults to the system local timezone.',
  inputSchema: {
    type: 'object',
    properties: {
      timeZone: {
        type: 'string',
        description:
          'Optional IANA timezone identifier, such as "UTC", "America/New_York", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo". If omitted, local system timezone is used.',
      },
    },
    required: [],
  },
  execute: (input) => {
    const now = new Date();
    const requestedTz = input.timeZone?.trim();

    let resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (requestedTz) {
      try {
        // Validate timezone
        Intl.DateTimeFormat(undefined, { timeZone: requestedTz });
        resolvedTz = requestedTz;
      } catch {
        // Fallback to local if invalid
      }
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTz,
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTz,
      weekday: 'long',
    });

    return {
      iso: now.toISOString(),
      formatted: formatter.format(now),
      timeZone: resolvedTz,
      dayOfWeek: dayFormatter.format(now),
      unixTimestamp: Math.floor(now.getTime() / 1000),
    };
  },
};
