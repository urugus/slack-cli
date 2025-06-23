import chalk from 'chalk';
import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { formatSlackTimestamp } from '../date-utils';
import { formatMessageWithMentions } from '../format-utils';
import { formatChannelName } from '../channel-formatter';

export interface MessageFormatterOptions {
  channel: any;
  messages: any[];
  users: Map<string, string>;
  countOnly: boolean;
  format: string;
}

class TableMessageFormatter extends AbstractFormatter<MessageFormatterOptions> {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly } = options;
    const channelName = formatChannelName(channel.name);

    console.log(chalk.bold(`${channelName}: ${channel.unread_count || 0} unread messages`));

    if (!countOnly && messages.length > 0) {
      console.log('');
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = message.user ? users.get(message.user) || message.user : 'unknown';
        console.log(`${chalk.gray(timestamp)} ${chalk.cyan(author)}`);
        const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
        console.log(text);
        console.log('');
      });
    }
  }
}

class SimpleMessageFormatter extends AbstractFormatter<MessageFormatterOptions> {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly } = options;
    const channelName = formatChannelName(channel.name);

    console.log(`${channelName} (${channel.unread_count || 0})`);

    if (!countOnly && messages.length > 0) {
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = message.user ? users.get(message.user) || message.user : 'unknown';
        const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
        console.log(`[${timestamp}] ${author}: ${text}`);
      });
    }
  }
}

class JsonMessageFormatter extends JsonFormatter<MessageFormatterOptions> {
  protected transform(options: MessageFormatterOptions) {
    const { channel, messages, users, countOnly } = options;
    const channelName = formatChannelName(channel.name);

    const output: any = {
      channel: channelName,
      channelId: channel.id,
      unreadCount: channel.unread_count || 0,
    };

    if (!countOnly && messages.length > 0) {
      output.messages = messages.map((message) => ({
        timestamp: formatSlackTimestamp(message.ts),
        author: message.user ? users.get(message.user) || message.user : 'unknown',
        text: message.text || '(no text)',
      }));
    }

    return output;
  }
}

const messageFormatterFactory = createFormatterFactory<MessageFormatterOptions>({
  table: new TableMessageFormatter(),
  simple: new SimpleMessageFormatter(),
  json: new JsonMessageFormatter(),
});

export function createMessageFormatter(format: string) {
  return messageFormatterFactory.create(format);
}
