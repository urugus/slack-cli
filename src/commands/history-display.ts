import { createHistoryFormatter } from '../utils/formatters/history-formatters';
import { Message } from '../utils/slack-api-client';

interface DisplayHistoryOptions {
  preserveOrder?: boolean;
  permalinks?: Map<string, string>;
}

export function displayHistoryResults(
  messages: Message[],
  users: Map<string, string>,
  channelName: string,
  format = 'table',
  options: DisplayHistoryOptions = {}
): void {
  // conversations.history returns newest-first, so reverse by default.
  const orderedMessages = options.preserveOrder ? [...messages] : [...messages].reverse();

  const formatter = createHistoryFormatter(format);
  formatter.format({
    channelName,
    messages: orderedMessages,
    users,
    permalinks: options.permalinks,
  });
}
