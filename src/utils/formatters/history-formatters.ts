import chalk from 'chalk';
import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { formatTimestampFixed } from '../date-utils';
import { formatMessageWithMentions, resolveUsername } from '../format-utils';
import { Message as SlackMessage } from '../slack-api-client';

export interface HistoryFormatterOptions {
  channelName: string;
  messages: SlackMessage[];
  users: Map<string, string>;
}

class TableHistoryFormatter extends AbstractFormatter<HistoryFormatterOptions> {
  format(options: HistoryFormatterOptions): void {
    const { channelName, messages, users } = options;

    console.log(chalk.bold(`\nMessage History for #${channelName}:`));

    if (messages.length === 0) {
      console.log(chalk.yellow('No messages found'));
      return;
    }

    console.log('');
    messages.forEach((message) => {
      const timestamp = formatTimestampFixed(message.ts);
      const username = resolveUsername(message, users);

      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(username)}`);
      const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
      console.log(text);
      console.log('');
    });

    console.log(chalk.green(`✓ Displayed ${messages.length} message(s)`));
  }
}

class SimpleHistoryFormatter extends AbstractFormatter<HistoryFormatterOptions> {
  format(options: HistoryFormatterOptions): void {
    const { messages, users } = options;

    if (messages.length === 0) {
      console.log('No messages found');
      return;
    }

    messages.forEach((message) => {
      const timestamp = formatTimestampFixed(message.ts);
      const username = resolveUsername(message, users);
      const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
      console.log(`[${timestamp}] ${username}: ${text}`);
    });
  }
}

class JsonHistoryFormatter extends JsonFormatter<HistoryFormatterOptions> {
  protected transform(options: HistoryFormatterOptions) {
    const { channelName, messages, users } = options;

    return {
      channel: channelName,
      messages: messages.map((message) => ({
        timestamp: formatTimestampFixed(message.ts),
        user: resolveUsername(message, users),
        text: message.text || '(no text)',
      })),
      total: messages.length,
    };
  }
}

const historyFormatterFactory = createFormatterFactory<HistoryFormatterOptions>({
  table: new TableHistoryFormatter(),
  simple: new SimpleHistoryFormatter(),
  json: new JsonHistoryFormatter(),
});

export function createHistoryFormatter(format: string) {
  return historyFormatterFactory.create(format);
}
