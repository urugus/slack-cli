import { Command } from 'commander';
import { API_LIMITS } from '../utils/constants';

export function validateMessageCount(
  value: string | undefined,
  command: Command
): number | undefined {
  if (!value) {
    return undefined;
  }

  const num = parseInt(value, 10);
  if (isNaN(num) || num < API_LIMITS.MIN_MESSAGE_COUNT || num > API_LIMITS.MAX_MESSAGE_COUNT) {
    command.error(
      `Error: Message count must be between ${API_LIMITS.MIN_MESSAGE_COUNT} and ${API_LIMITS.MAX_MESSAGE_COUNT}`
    );
  }

  return num;
}

export function validateDateFormat(
  value: string | undefined,
  command: Command
): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (isNaN(timestamp)) {
    command.error('Error: Invalid date format. Use YYYY-MM-DD HH:MM:SS');
  }

  return value;
}

export function prepareSinceTimestamp(since: string | undefined): string | undefined {
  if (!since) {
    return undefined;
  }

  // Convert date to Unix timestamp (in seconds)
  const timestamp = Math.floor(Date.parse(since) / 1000);
  return timestamp.toString();
}
