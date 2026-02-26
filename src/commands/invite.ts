import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { InviteOptions } from '../types/commands';
import { parseProfile } from '../utils/option-parsers';

export function setupInviteCommand(): Command {
  const inviteCommand = new Command('invite')
    .description('Invite user(s) to a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-u, --users <users>', 'Comma-separated user IDs to invite')
    .option('--force', 'Continue inviting valid users even if some IDs are invalid')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: InviteOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const userIds = options.users
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0);
        if (userIds.length === 0) {
          throw new Error('At least one valid user ID is required');
        }

        await client.inviteToChannel(options.channel, userIds, options.force);
        console.log(chalk.green(`✓ Invited user(s) to channel #${options.channel}`));
      })
    );

  return inviteCommand;
}
