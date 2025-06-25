import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { SlackApiClient, ChannelUnreadResult, Channel } from '../utils/slack-api-client';
import { UnreadOptions } from '../types/commands';
import chalk from 'chalk';
import { createChannelFormatter } from '../utils/formatters/channel-formatters';
import { createMessageFormatter } from '../utils/formatters/message-formatters';
import { DEFAULTS } from '../utils/constants';
import { parseLimit, parseFormat, parseBoolean } from '../utils/option-parsers';

async function fetchChannelUnreadData(
  client: SlackApiClient,
  channelName: string
) {
  return await client.getChannelUnread(channelName);
}

function formatChannelUnreadOutput(
  result: ChannelUnreadResult,
  format: string,
  countOnly: boolean
): void {
  const formatter = createMessageFormatter(format);
  formatter.format({
    channel: result.channel,
    messages: result.messages,
    users: result.users,
    countOnly: countOnly,
    format: format,
  });
}

async function markChannelAsRead(
  client: SlackApiClient,
  channel: Channel
): Promise<void> {
  await client.markAsRead(channel.id);
  console.log(chalk.green(`✓ Marked messages in #${channel.name} as read`));
}

async function handleSpecificChannelUnread(
  client: SlackApiClient,
  options: UnreadOptions
): Promise<void> {
  const result = await fetchChannelUnreadData(client, options.channel!);

  const format = parseFormat(options.format);
  const countOnly = parseBoolean(options.countOnly);

  formatChannelUnreadOutput(result, format, countOnly);

  if (parseBoolean(options.markRead)) {
    await markChannelAsRead(client, result.channel);
  }
}

async function fetchAllUnreadChannels(client: SlackApiClient) {
  return await client.listUnreadChannels();
}

function formatAllChannelsOutput(
  channels: Channel[],
  format: string,
  countOnly: boolean,
  limit: number
): void {
  const displayChannels = channels.slice(0, limit);
  const formatter = createChannelFormatter(format, countOnly);
  formatter.format({ channels: displayChannels, countOnly: countOnly });
}

async function markAllChannelsAsRead(
  client: SlackApiClient,
  channels: Channel[]
): Promise<void> {
  for (const channel of channels) {
    await client.markAsRead(channel.id);
  }
  console.log(chalk.green('✓ Marked all messages as read'));
}

async function handleAllChannelsUnread(
  client: SlackApiClient,
  options: UnreadOptions
): Promise<void> {
  const channels = await fetchAllUnreadChannels(client);

  if (channels.length === 0) {
    console.log(chalk.green('✓ No unread messages'));
    return;
  }

  const limit = parseLimit(options.limit, DEFAULTS.UNREAD_DISPLAY_LIMIT);
  const format = parseFormat(options.format);
  const countOnly = parseBoolean(options.countOnly);

  formatAllChannelsOutput(channels, format, countOnly, limit);

  if (parseBoolean(options.markRead)) {
    await markAllChannelsAsRead(client, channels);
  }
}

export function setupUnreadCommand(): Command {
  const unreadCommand = new Command('unread')
    .description('Show unread messages across channels')
    .option('-c, --channel <channel>', 'Show unread for a specific channel')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--count-only', 'Show only unread counts', false)
    .option(
      '--limit <number>',
      'Maximum number of channels to display',
      DEFAULTS.UNREAD_DISPLAY_LIMIT.toString()
    )
    .option('--mark-read', 'Mark messages as read after fetching', false)
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
