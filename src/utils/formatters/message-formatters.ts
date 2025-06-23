import chalk from 'chalk';
import { formatSlackTimestamp } from '../date-utils';
import { formatMessageWithMentions } from '../format-utils';

export interface MessageFormatterOptions {
  channel: any;
  messages: any[];
  users: Map<string, string>;
  countOnly: boolean;
  format: string;
}

export interface MessageFormatter {
  format(options: MessageFormatterOptions): void;
}

export class TableMessageFormatter implements MessageFormatter {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly } = options;
    const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`;
    
    console.log(chalk.bold(`${channelName}: ${channel.unread_count || 0} unread messages`));
    
    if (!countOnly && messages.length > 0) {
      console.log('');
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = message.user ? users.get(message.user) || message.user : 'unknown';
        console.log(`${chalk.gray(timestamp)} ${chalk.cyan(author)}`);
        const text = message.text
          ? formatMessageWithMentions(message.text, users)
          : '(no text)';
        console.log(text);
        console.log('');
      });
    }
  }
}

export class SimpleMessageFormatter implements MessageFormatter {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly } = options;
    const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`;
    
    console.log(`${channelName} (${channel.unread_count || 0})`);
    
    if (!countOnly && messages.length > 0) {
      messages.forEach((message) => {
        const timestamp = formatSlackTimestamp(message.ts);
        const author = message.user ? users.get(message.user) || message.user : 'unknown';
        const text = message.text
          ? formatMessageWithMentions(message.text, users)
          : '(no text)';
        console.log(`[${timestamp}] ${author}: ${text}`);
      });
    }
  }
}

export class JsonMessageFormatter implements MessageFormatter {
  format(options: MessageFormatterOptions): void {
    const { channel, messages, users, countOnly } = options;
    const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`;
    
    const output: any = {
      channel: channelName,
      channelId: channel.id,
      unreadCount: channel.unread_count || 0
    };
    
    if (!countOnly && messages.length > 0) {
      output.messages = messages.map((message) => ({
        timestamp: formatSlackTimestamp(message.ts),
        author: message.user ? users.get(message.user) || message.user : 'unknown',
        text: message.text || '(no text)'
      }));
    }
    
    console.log(JSON.stringify(output, null, 2));
  }
}

export function createMessageFormatter(format: string): MessageFormatter {
  switch (format) {
    case 'json':
      return new JsonMessageFormatter();
    case 'simple':
      return new SimpleMessageFormatter();
    case 'table':
    default:
      return new TableMessageFormatter();
  }
}