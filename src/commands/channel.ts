import { Command } from 'commander';
import {
  ChannelInfoOptions,
  ChannelSetPurposeOptions,
  ChannelSetTopicOptions,
} from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { createChannelInfoFormatter } from '../utils/formatters/channel-info-formatters';
import { parseFormat, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';

export function setupChannelCommand(): Command {
  const channelCommand = new Command('channel').description(
    'Manage channel topic, purpose, and info'
  );

  channelCommand
    .command('info')
    .description('Display channel details including topic and purpose')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: ChannelInfoOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const channel = await client.getChannelDetail(options.channel);
        const format = parseFormat(options.format);
        const formatter = createChannelInfoFormatter(format);
        formatter.format({ channel });
      })
    );

  channelCommand
    .command('set-topic')
    .description('Set the topic of a channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .requiredOption('--topic <topic>', 'New topic text')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: ChannelSetTopicOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.setTopic(options.channel, options.topic);
        console.log(`✓ Topic updated for #${options.channel}`);
      })
    );

  channelCommand
    .command('set-purpose')
    .description('Set the purpose of a channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .requiredOption('--purpose <purpose>', 'New purpose text')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: ChannelSetPurposeOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.setPurpose(options.channel, options.purpose);
        console.log(`✓ Purpose updated for #${options.channel}`);
      })
    );

  return channelCommand;
}
