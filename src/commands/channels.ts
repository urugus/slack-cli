import { Command } from 'commander';
import { ChannelsOptions } from '../types/commands';
import { getChannelTypes, mapChannelToInfo } from '../utils/channel-formatter';
import { withSlackClient } from '../utils/command-support';
import { wrapCommand } from '../utils/command-wrapper';
import { ERROR_MESSAGES } from '../utils/constants';
import { createChannelsListFormatter } from '../utils/formatters/channels-list-formatters';
import { parseBoolean, parseFormat, parseLimit } from '../utils/option-parsers';

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
        await withSlackClient(options, async (client) => {
          const types = getChannelTypes(options.type);
          const limit = parseLimit(options.limit, 100);
          const channels = await client.listChannels({
            types,
            exclude_archived: !parseBoolean(options.includeArchived),
            limit,
          });

          if (channels.length === 0) {
            console.log(ERROR_MESSAGES.NO_CHANNELS_FOUND);
            return;
          }

          const channelInfos = channels.map(mapChannelToInfo);
          const format = parseFormat(options.format);
          const formatter = createChannelsListFormatter(format);
          formatter.format({ channels: channelInfos });
        });
      })
    );

  return channelsCommand;
}
