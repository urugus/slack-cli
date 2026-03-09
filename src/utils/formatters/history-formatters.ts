import chalk from 'chalk';
import { Message as SlackMessage } from '../../types/slack';
import { formatTimestampFixed } from '../date-utils';
import { formatMessageWithMentions, resolveUsername } from '../format-utils';
import { sanitizeTerminalText } from '../terminal-sanitizer';
import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';

export interface HistoryFormatterOptions {
  channelName: string;
  messages: SlackMessage[];
  users: Map<string, string>;
  permalinks?: Map<string, string>;
}

class TableHistoryFormatter extends AbstractFormatter<HistoryFormatterOptions> {
  format(options: HistoryFormatterOptions): void {
    const { channelName, messages, users, permalinks } = options;

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
      if (permalinks?.has(message.ts)) {
        console.log(chalk.blue(sanitizeTerminalText(permalinks.get(message.ts)!)));
      }
      console.log('');
    });

    console.log(chalk.green(`✓ Displayed ${messages.length} message(s)`));
  }
}

class SimpleHistoryFormatter extends AbstractFormatter<HistoryFormatterOptions> {
  format(options: HistoryFormatterOptions): void {
    const { messages, users, permalinks } = options;

    if (messages.length === 0) {
      console.log('No messages found');
      return;
    }

    messages.forEach((message) => {
      const timestamp = formatTimestampFixed(message.ts);
      const username = resolveUsername(message, users);
      const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
      const link = permalinks?.get(message.ts);
      const linkSuffix = link ? ` ${sanitizeTerminalText(link)}` : '';
      console.log(`[${timestamp}] ${username}: ${text}${linkSuffix}`);
    });
  }
}

class JsonHistoryFormatter extends JsonFormatter<HistoryFormatterOptions> {
  protected transform(options: HistoryFormatterOptions) {
    const { channelName, messages, users, permalinks } = options;

    return {
      channel: channelName,
      messages: messages.map((message) => ({
        ts: message.ts,
        timestamp: formatTimestampFixed(message.ts),
        user: resolveUsername(message, users),
        text: message.text || '(no text)',
        ...(message.thread_ts !== undefined && { thread_ts: message.thread_ts }),
        ...(message.reply_count !== undefined && { reply_count: message.reply_count }),
        ...(permalinks?.has(message.ts) && { permalink: permalinks.get(message.ts) }),
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
