import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { SlackApiClient, Channel } from '../utils/slack-api-client';
import { UnreadOptions } from '../types/commands';
import chalk from 'chalk';
import { formatSlackTimestamp } from '../utils/date-utils';
import { formatChannelName } from '../utils/channel-formatter';

async function handleSpecificChannelUnread(
  client: SlackApiClient,
  options: UnreadOptions
): Promise<void> {
  const result = await client.getChannelUnread(options.channel!);
  const channelName = formatChannelName(result.channel.name);

  console.log(chalk.bold(`${channelName}: ${result.channel.unread_count || 0} unread messages`));

  if (!options.countOnly && result.messages.length > 0) {
    console.log('');
    result.messages.forEach((message) => {
      const timestamp = formatSlackTimestamp(message.ts);
      const author = message.user ? result.users.get(message.user) || message.user : 'unknown';
      console.log(`${chalk.gray(timestamp)} ${chalk.cyan(author)}`);
      console.log(message.text || '(no text)');
      console.log('');
    });
  }
}

async function handleAllChannelsUnread(client: SlackApiClient, options: UnreadOptions): Promise<void> {
  const channels = await client.listUnreadChannels();

  if (channels.length === 0) {
    console.log(chalk.green('✓ No unread messages'));
    return;
  }

  // Apply limit
  const limit = parseInt(options.limit || '50', 10);
  const displayChannels = channels.slice(0, limit);

  if (options.countOnly) {
    displayCountOnly(displayChannels);
  } else if (options.format === 'json') {
    displayAsJson(displayChannels);
  } else if (options.format === 'simple') {
    displayAsSimple(displayChannels);
  } else {
    displayAsTable(displayChannels);
  }
}

function displayCountOnly(channels: Channel[]): void {
  let totalUnread = 0;
  channels.forEach((channel) => {
    const count = channel.unread_count || 0;
    totalUnread += count;
    const channelName = formatChannelName(channel.name);
    console.log(`${channelName}: ${count}`);
  });
  console.log(chalk.bold(`Total: ${totalUnread} unread messages`));
}

function displayAsJson(channels: Channel[]): void {
  const output = channels.map((channel) => ({
    channel: formatChannelName(channel.name),
    channelId: channel.id,
    unreadCount: channel.unread_count || 0,
  }));
  console.log(JSON.stringify(output, null, 2));
}

function displayAsSimple(channels: Channel[]): void {
  channels.forEach((channel) => {
    const channelName = formatChannelName(channel.name);
    console.log(`${channelName} (${channel.unread_count || 0})`);
  });
}

function displayAsTable(channels: Channel[]): void {
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

export function setupUnreadCommand(): Command {
  const unreadCommand = new Command('unread')
    .description('Show unread messages across channels')
    .option('-c, --channel <channel>', 'Show unread for a specific channel')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--count-only', 'Show only unread counts', false)
    .option('--limit <number>', 'Maximum number of channels to display', '50')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: UnreadOptions) => {
        const client = await createSlackClient(options.profile);

        if (options.channel) {
          await handleSpecificChannelUnread(client, options);
        } else {
          await handleAllChannelsUnread(client, options);
        }
      })
    );

  return unreadCommand;
}
