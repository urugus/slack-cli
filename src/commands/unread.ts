import { Command } from 'commander';
import { SlackApiClient } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';
import { getConfigOrThrow } from '../utils/config-helper';
import { UnreadOptions } from '../types/commands';
import chalk from 'chalk';
import { formatSlackTimestamp } from '../utils/date-utils';

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
        const config = await getConfigOrThrow(options.profile);
        const client = new SlackApiClient(config.token);

        if (options.channel) {
          // Show unread for a specific channel
          const result = await client.getChannelUnread(options.channel);
          const channelName = result.channel.name?.startsWith('#') ? result.channel.name : `#${result.channel.name}`;
          
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
        } else {
          // Show all channels with unread messages
          const channels = await client.listUnreadChannels();
          
          if (channels.length === 0) {
            console.log(chalk.green('✓ No unread messages'));
            return;
          }

          // Apply limit
          const limit = parseInt(options.limit || '50', 10);
          const displayChannels = channels.slice(0, limit);

          if (options.countOnly) {
            // Simple count display
            let totalUnread = 0;
            displayChannels.forEach((channel) => {
              const count = channel.unread_count || 0;
              totalUnread += count;
              const channelName = channel.name?.startsWith('#') ? channel.name : `#${channel.name}`;
              console.log(`${channelName}: ${count}`);
            });
            console.log(chalk.bold(`Total: ${totalUnread} unread messages`));
          } else if (options.format === 'json') {
            // JSON format
            const output = displayChannels.map((channel) => ({
              channel: channel.name?.startsWith('#') ? channel.name : `#${channel.name}`,
              channelId: channel.id,
              unreadCount: channel.unread_count || 0,
            }));
            console.log(JSON.stringify(output, null, 2));
          } else if (options.format === 'simple') {
            // Simple format
            displayChannels.forEach((channel) => {
              const channelName = channel.name?.startsWith('#') ? channel.name : `#${channel.name}`;
              console.log(`${channelName} (${channel.unread_count || 0})`);
            });
          } else {
            // Table format (default)
            console.log(chalk.bold('Channel          Unread  Last Message'));
            console.log('─'.repeat(50));
            
            displayChannels.forEach((channel) => {
              const channelName = channel.name?.startsWith('#') ? channel.name : `#${channel.name}`;
              const paddedName = channelName.padEnd(16);
              const count = (channel.unread_count || 0).toString().padEnd(6);
              const lastRead = channel.last_read ? formatSlackTimestamp(channel.last_read) : 'Unknown';
              console.log(`${paddedName} ${count}  ${lastRead}`);
            });
          }
        }
      })
    );

  return unreadCommand;
}