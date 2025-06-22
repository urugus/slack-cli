import chalk from 'chalk';
import { BaseFormatter } from './output-formatter';
import { Channel } from '../slack-api-client';
import { formatChannelName } from '../channel-formatter';
import { formatSlackTimestamp } from '../date-utils';

export class ChannelTableFormatter extends BaseFormatter<Channel> {
  format(channels: Channel[]): void {
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

export class ChannelSimpleFormatter extends BaseFormatter<Channel> {
  format(channels: Channel[]): void {
    channels.forEach((channel) => {
      const channelName = formatChannelName(channel.name);
      console.log(`${channelName} (${channel.unread_count || 0})`);
    });
  }
}

export class ChannelJsonFormatter extends BaseFormatter<Channel> {
  format(channels: Channel[]): void {
    const output = channels.map((channel) => ({
      channel: formatChannelName(channel.name),
      channelId: channel.id,
      unreadCount: channel.unread_count || 0,
    }));
    console.log(JSON.stringify(output, null, 2));
  }
}

export class ChannelCountFormatter extends BaseFormatter<Channel> {
  format(channels: Channel[]): void {
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

export function createChannelFormatter(format: string, countOnly: boolean): BaseFormatter<Channel> {
  if (countOnly) {
    return new ChannelCountFormatter();
  }

  switch (format) {
    case 'json':
      return new ChannelJsonFormatter();
    case 'simple':
      return new ChannelSimpleFormatter();
    case 'table':
    default:
      return new ChannelTableFormatter();
  }
}
