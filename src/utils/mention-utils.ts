import { USER_MENTION_PATTERN } from './slack-patterns';

/**
 * Extracts all user IDs from mentions in a text
 * @param text - The text containing Slack mentions
 * @returns Array of unique user IDs found in mentions
 */
export function extractUserIdsFromMentions(text: string): string[] {
  const userIds: string[] = [];
  const matches = text.matchAll(USER_MENTION_PATTERN);

  for (const match of matches) {
    const userId = match[1];
    if (userId) {
      userIds.push(userId);
    }
  }

  return userIds;
}

/**
 * Extracts all unique user IDs from an array of messages
 * Includes both message authors and mentioned users
 * @param messages - Array of messages to extract user IDs from
 * @returns Array of unique user IDs
 */
export function extractAllUserIds(messages: Array<{ user?: string; text?: string }>): string[] {
  const userIds = new Set<string>();

  for (const message of messages) {
    // Add message author
    if (message.user) {
      userIds.add(message.user);
    }

    // Add mentioned users
    if (message.text) {
      const mentionedIds = extractUserIdsFromMentions(message.text);
      for (const id of mentionedIds) {
        userIds.add(id);
      }
    }
  }

  return Array.from(userIds);
}
