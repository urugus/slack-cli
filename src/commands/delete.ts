import chalk from 'chalk';
import { Command } from 'commander';
import { DeleteOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';

export function setupDeleteCommand(): Command {
  const deleteCommand = new Command('delete')
    .description('Delete a sent message')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('--ts <timestamp>', 'Message timestamp to delete')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.deleteTimestamp]))
    .action(
      wrapCommand(async (options: DeleteOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.deleteMessage(options.channel, options.ts);
        console.log(chalk.green(`✓ Message deleted successfully from #${options.channel}`));
      })
    );

  return deleteCommand;
}
