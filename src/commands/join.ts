import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { JoinOptions } from '../types/commands';
import { parseProfile } from '../utils/option-parsers';

export function setupJoinCommand(): Command {
  const joinCommand = new Command('join')
    .description('Join a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: JoinOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.joinChannel(options.channel);
        console.log(chalk.green(`✓ Joined channel #${options.channel}`));
      })
    );

  return joinCommand;
}
