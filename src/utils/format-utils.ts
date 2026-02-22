import { USER_MENTION_PATTERN } from './slack-patterns';
import { Message } from './slack-api-client';

export function formatMessageWithMentions(message: string, users: Map<string, string>): string {
  // Replace <@USERID> mentions with @username
  return message.replace(USER_MENTION_PATTERN, (match, userId) => {
    const username = users.get(userId) || userId;
    return `@${username}`;
  });
}

export function resolveUsername(message: Message, users: Map<string, string>): string {
  if (message.user) {
    return users.get(message.user) || 'Unknown User';
  }
  if (message.bot_id) {
    return 'Bot';
  }
  return 'Unknown';
}
