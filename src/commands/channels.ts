import { Command } from 'commander';
import { ProfileConfigManager } from '../utils/profile-config';
import { slackApiClient } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';

interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  members: number;
  created: string;
  purpose: string;
}

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
      wrapCommand(async (options) => {
        // Get configuration
        const configManager = new ProfileConfigManager();
        const config = await configManager.getConfig(options.profile);

        if (!config) {
          const profiles = await configManager.listProfiles();
          const profileName =
            options.profile || profiles.find((p) => p.isDefault)?.name || 'default';
          throw new Error(`No token configured for profile: ${profileName}`);
        }

        // Map channel type to API types
        let types: string;
        switch (options.type) {
          case 'public':
            types = 'public_channel';
            break;
          case 'private':
            types = 'private_channel';
            break;
          case 'im':
            types = 'im';
            break;
          case 'mpim':
            types = 'mpim';
            break;
          case 'all':
            types = 'public_channel,private_channel,mpim,im';
            break;
          default:
            types = 'public_channel';
        }

        // List channels
        const channels = await slackApiClient.listChannels(config.token, {
          types,
          exclude_archived: !options.includeArchived,
          limit: parseInt(options.limit, 10),
        });

        if (channels.length === 0) {
          console.log('No channels found');
          return;
        }

        // Format and display channels
        const channelInfos: ChannelInfo[] = channels.map((channel) => {
          let type = 'unknown';
          if (channel.is_channel && !channel.is_private) type = 'public';
          else if (channel.is_group || (channel.is_channel && channel.is_private)) type = 'private';
          else if (channel.is_im) type = 'im';
          else if (channel.is_mpim) type = 'mpim';

          return {
            id: channel.id,
            name: channel.name || 'unnamed',
            type,
            members: channel.num_members || 0,
            created: new Date(channel.created * 1000).toISOString().split('T')[0],
            purpose: channel.purpose?.value || '',
          };
        });

        switch (options.format) {
          case 'simple':
            channelInfos.forEach((channel) => console.log(channel.name));
            break;

          case 'json':
            console.log(
              JSON.stringify(
                channelInfos.map((channel) => ({
                  id: channel.id,
                  name: channel.name,
                  type: channel.type,
                  members: channel.members,
                  created: channel.created + 'T00:00:00Z',
                  purpose: channel.purpose,
                })),
                null,
                2
              )
            );
            break;

          case 'table':
          default:
            // Print table header
            console.log('Name              Type      Members  Created      Description');
            console.log('─'.repeat(65));

            // Print channel rows
            channelInfos.forEach((channel) => {
              const name = channel.name.padEnd(17);
              const type = channel.type.padEnd(9);
              const members = channel.members.toString().padEnd(8);
              const created = channel.created.padEnd(12);
              const purpose =
                channel.purpose.length > 30
                  ? channel.purpose.substring(0, 27) + '...'
                  : channel.purpose;

              console.log(`${name} ${type} ${members} ${created} ${purpose}`);
            });
            break;
        }
      })
    );

  return channelsCommand;
}
