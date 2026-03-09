import chalk from 'chalk';
import { formatChannelName } from '../channel-formatter';
import { formatSlackTimestamp } from '../date-utils';
import { Channel } from '../../types/slack';
import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';

export interface ChannelFormatterOptions {
  channels: Channel[];
  countOnly?: boolean;
}

class ChannelTableFormatter extends AbstractFormatter<ChannelFormatterOptions> {
  format({ channels }: ChannelFormatterOptions): void {
    console.log(chalk.bold('Channel          Unread  Last Message'));
    console.log('─'.repeat(50));

    channels.forEach((channel) => {
      const channelName = formatChannelName(channel.name);
      const paddedName = channelName.padEnd(16);
      const count = (channel.unread_count || 0).toString().padEnd(6);
      const lastRead = channel.last_read ? formatSlackTimestamp(channel.last_read) : 'Unknown';
      console.log(`${paddedName} ${count}  ${lastRead}`);
    });
  }
}

class ChannelSimpleFormatter extends AbstractFormatter<ChannelFormatterOptions> {
  format({ channels }: ChannelFormatterOptions): void {
    channels.forEach((channel) => {
      const channelName = formatChannelName(channel.name);
      console.log(`${channelName} (${channel.unread_count || 0})`);
    });
  }
}

class ChannelJsonFormatter extends JsonFormatter<ChannelFormatterOptions> {
  protected transform({ channels }: ChannelFormatterOptions) {
    return channels.map((channel) => ({
      channel: formatChannelName(channel.name),
      channelId: channel.id,
      unreadCount: channel.unread_count || 0,
    }));
  }
}

class ChannelCountFormatter extends AbstractFormatter<ChannelFormatterOptions> {
  format({ channels }: ChannelFormatterOptions): void {
    let totalUnread = 0;
    channels.forEach((channel) => {
      const count = channel.unread_count || 0;
      totalUnread += count;
      const channelName = formatChannelName(channel.name);
      console.log(`${channelName}: ${count}`);
    });
    console.log(chalk.bold(`Total: ${totalUnread} unread messages`));
  }
}

const channelFormatterFactory = createFormatterFactory<ChannelFormatterOptions>({
  table: new ChannelTableFormatter(),
  simple: new ChannelSimpleFormatter(),
  json: new ChannelJsonFormatter(),
  count: new ChannelCountFormatter(),
});

export function createChannelFormatter(format: string, countOnly: boolean) {
  if (countOnly) {
    return channelFormatterFactory.create('count');
  }
  return channelFormatterFactory.create(format);
}
