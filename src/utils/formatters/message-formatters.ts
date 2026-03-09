import chalk from 'chalk';
import { Channel, Message } from '../../types/slack';
import { formatChannelName } from '../channel-formatter';
import { formatSlackTimestamp } from '../date-utils';
import { formatMessageWithMentions } from '../format-utils';
import { sanitizeTerminalText } from '../terminal-sanitizer';
import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';

export interface MessageFormatterOptions {
  channel: Channel;
  messages: Message[];
  users: Map<string, string>;
  countOnly: boolean;
  format: string;
  totalUnreadCount?: number;
  displayedMessageCount?: number;
}

class TableMessageFormatter extends AbstractFormatter<MessageFormatterOptions> {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly, totalUnreadCount, displayedMessageCount } =
      options;
    const channelName = formatChannelName(channel.name);
    const unreadCount = totalUnreadCount ?? channel.unread_count ?? 0;

    console.log(chalk.bold(`${channelName}: ${unreadCount} unread messages`));

    if (!countOnly && messages.length > 0) {
      console.log('');
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = sanitizeTerminalText(
          message.user ? users.get(message.user) || message.user : 'unknown'
        );
        console.log(`${chalk.gray(timestamp)} ${chalk.cyan(author)}`);
        const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
        console.log(text);
        console.log('');
      });

      if (
        displayedMessageCount !== undefined &&
        totalUnreadCount !== undefined &&
        displayedMessageCount < totalUnreadCount
      ) {
        console.log(
          chalk.gray(
            `Showing latest ${displayedMessageCount} of ${totalUnreadCount} unread messages`
          )
        );
      }
    }
  }
}

class SimpleMessageFormatter extends AbstractFormatter<MessageFormatterOptions> {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly, totalUnreadCount, displayedMessageCount } =
      options;
    const channelName = formatChannelName(channel.name);
    const unreadCount = totalUnreadCount ?? channel.unread_count ?? 0;

    console.log(`${channelName} (${unreadCount})`);

    if (!countOnly && messages.length > 0) {
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = sanitizeTerminalText(
          message.user ? users.get(message.user) || message.user : 'unknown'
        );
        const text = message.text ? formatMessageWithMentions(message.text, users) : '(no text)';
        console.log(`[${timestamp}] ${author}: ${text}`);
      });

      if (
        displayedMessageCount !== undefined &&
        totalUnreadCount !== undefined &&
        displayedMessageCount < totalUnreadCount
      ) {
        console.log(
          `Showing latest ${displayedMessageCount} of ${totalUnreadCount} unread messages`
        );
      }
    }
  }
}

interface MessageJsonOutput {
  channel: string;
  channelId: string;
  unreadCount: number;
  displayedMessageCount?: number;
  isTruncated?: boolean;
  messages?: {
    timestamp: string;
    author: string;
    text: string;
  }[];
}

class JsonMessageFormatter extends JsonFormatter<MessageFormatterOptions, MessageJsonOutput> {
  protected transform(options: MessageFormatterOptions): MessageJsonOutput {
    const { channel, messages, users, countOnly, totalUnreadCount, displayedMessageCount } =
      options;
    const channelName = formatChannelName(channel.name);
    const unreadCount = totalUnreadCount ?? channel.unread_count ?? 0;

    const output: MessageJsonOutput = {
      channel: channelName,
      channelId: channel.id,
      unreadCount,
    };

    if (!countOnly && messages.length > 0) {
      output.messages = messages.map((message) => ({
        timestamp: formatSlackTimestamp(message.ts),
        author: message.user ? users.get(message.user) || message.user : 'unknown',
        text: message.text || '(no text)',
      }));
    }

    if (
      !countOnly &&
      displayedMessageCount !== undefined &&
      totalUnreadCount !== undefined &&
      displayedMessageCount < totalUnreadCount
    ) {
      Object.assign(output, {
        displayedMessageCount,
        isTruncated: true,
      });
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
