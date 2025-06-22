import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { SlackApiClient } from '../utils/slack-api-client';
import { UnreadOptions } from '../types/commands';
import chalk from 'chalk';
import { formatSlackTimestamp } from '../utils/date-utils';
import { formatChannelName } from '../utils/channel-formatter';
import { createChannelFormatter } from '../utils/formatters/channel-formatters';
import { DEFAULTS } from '../utils/constants';

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

async function handleAllChannelsUnread(
  client: SlackApiClient,
  options: UnreadOptions
): Promise<void> {
  const channels = await client.listUnreadChannels();

  if (channels.length === 0) {
    console.log(chalk.green('✓ No unread messages'));
    return;
  }

  // Apply limit
  const limit = parseInt(options.limit || DEFAULTS.UNREAD_DISPLAY_LIMIT.toString(), 10);
  const displayChannels = channels.slice(0, limit);

  const formatter = createChannelFormatter(options.format || 'table', options.countOnly || false);
  formatter.format(displayChannels);
}

export function setupUnreadCommand(): Command {
  const unreadCommand = new Command('unread')
    .description('Show unread messages across channels')
    .option('-c, --channel <channel>', 'Show unread for a specific channel')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--count-only', 'Show only unread counts', false)
    .option('--limit <number>', 'Maximum number of channels to display', DEFAULTS.UNREAD_DISPLAY_LIMIT.toString())
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
