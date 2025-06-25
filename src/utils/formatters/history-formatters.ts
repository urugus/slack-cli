import chalk from 'chalk';
import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { formatSlackTimestamp } from '../date-utils';

function formatTimestampFixed(slackTimestamp: string): string {
  const timestamp = parseFloat(slackTimestamp);
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
import { formatMessageWithMentions } from '../format-utils';
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
      const username = this.getUsername(message, users);
      
      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(username)}`);
      const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
      console.log(text);
      console.log('');
    });

    console.log(chalk.green(`✓ Displayed ${messages.length} message(s)`));
  }

  private getUsername(message: SlackMessage, users: Map<string, string>): string {
    if (message.user) {
      return users.get(message.user) || 'Unknown User';
    }
    if (message.bot_id) {
      return 'Bot';
    }
    return 'Unknown';
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
      const username = this.getUsername(message, users);
      const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
      console.log(`[${timestamp}] ${username}: ${text}`);
    });
  }

  private getUsername(message: SlackMessage, users: Map<string, string>): string {
    if (message.user) {
      return users.get(message.user) || 'Unknown User';
    }
    if (message.bot_id) {
      return 'Bot';
    }
    return 'Unknown';
  }
}

class JsonHistoryFormatter extends JsonFormatter<HistoryFormatterOptions> {
  protected transform(options: HistoryFormatterOptions) {
    const { channelName, messages, users } = options;

    return {
      channel: channelName,
      messages: messages.map((message) => ({
        timestamp: formatTimestampFixed(message.ts),
        user: this.getUsername(message, users),
        text: message.text || '(no text)',
      })),
      total: messages.length,
    };
  }

  private getUsername(message: SlackMessage, users: Map<string, string>): string {
    if (message.user) {
      return users.get(message.user) || 'Unknown User';
    }
    if (message.bot_id) {
      return 'Bot';
    }
    return 'Unknown';
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