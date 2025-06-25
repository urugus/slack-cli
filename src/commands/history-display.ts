import { Message } from '../utils/slack-api-client';
import { createHistoryFormatter } from '../utils/formatters/history-formatters';

export function displayHistoryResults(
  messages: Message[],
  users: Map<string, string>,
  channelName: string,
  format = 'table'
): void {
  // Display messages in reverse order (oldest first)
  const orderedMessages = [...messages].reverse();

  const formatter = createHistoryFormatter(format);
  formatter.format({
    channelName,
    messages: orderedMessages,
    users,
  });
}
