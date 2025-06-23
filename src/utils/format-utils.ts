import { USER_MENTION_PATTERN } from './slack-patterns';

export function formatMessageWithMentions(message: string, users: Map<string, string>): string {
  // Replace <@USERID> mentions with @username
  return message.replace(USER_MENTION_PATTERN, (match, userId) => {
    const username = users.get(userId) || userId;
    return `@${username}`;
  });
}
