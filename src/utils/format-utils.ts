import { Message } from '../types/slack';
import { USER_MENTION_PATTERN } from './slack-patterns';
import { sanitizeTerminalText } from './terminal-sanitizer';

export function formatMessageWithMentions(message: string, users: Map<string, string>): string {
  const sanitizedMessage = sanitizeTerminalText(message);

  // Replace <@USERID> mentions with @username
  return sanitizedMessage.replace(USER_MENTION_PATTERN, (match, userId) => {
    const username = sanitizeTerminalText(users.get(userId) || userId);
    return `@${username}`;
  });
}

export function resolveUsername(message: Message, users: Map<string, string>): string {
  if (message.user) {
    return sanitizeTerminalText(users.get(message.user) || 'Unknown User');
  }
  if (message.bot_id) {
    return 'Bot';
  }
  return 'Unknown';
}
