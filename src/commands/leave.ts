import chalk from 'chalk';
import { Command } from 'commander';
import { LeaveOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseProfile } from '../utils/option-parsers';

export function setupLeaveCommand(): Command {
  const leaveCommand = new Command('leave')
    .description('Leave a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: LeaveOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.leaveChannel(options.channel);
        console.log(chalk.green(`✓ Left channel #${options.channel}`));
      })
    );

  return leaveCommand;
}
