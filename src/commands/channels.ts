import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { ERROR_MESSAGES } from '../utils/constants';
import { ChannelsOptions } from '../types/commands';
import {
  mapChannelToInfo,
  formatChannelsAsTable,
  formatChannelsAsSimple,
  formatChannelsAsJson,
  getChannelTypes,
} from '../utils/channel-formatter';

export function setupChannelsCommand(): Command {
  const channelsCommand = new Command('channels');

  channelsCommand
    .description('List Slack channels')
    .option('--type <type>', 'Channel type: public, private, im, mpim, all', 'public')
    .option('--include-archived', 'Include archived channels', false)
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--limit <number>', 'Maximum number of channels to list', '100')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: ChannelsOptions) => {
        // Create Slack client
        const client = await createSlackClient(options.profile);

        // Map channel type to API types
        const types = getChannelTypes(options.type);

        // List channels
        const channels = await client.listChannels({
          types,
          exclude_archived: !options.includeArchived,
          limit: parseInt(options.limit, 10),
        });

        if (channels.length === 0) {
          console.log(ERROR_MESSAGES.NO_CHANNELS_FOUND);
          return;
        }

        // Format and display channels
        const channelInfos = channels.map(mapChannelToInfo);

        switch (options.format) {
          case 'simple':
            formatChannelsAsSimple(channelInfos);
            break;

          case 'json':
            formatChannelsAsJson(channelInfos);
            break;

          case 'table':
          default:
            formatChannelsAsTable(channelInfos);
            break;
        }
      })
    );

  return channelsCommand;
}
