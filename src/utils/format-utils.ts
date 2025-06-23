export function formatMessageWithMentions(message: string, users: Map<string, string>): string {
  // Replace <@USERID> mentions with @username
  return message.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const username = users.get(userId) || userId;
    return `@${username}`;
  });
}