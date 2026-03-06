import chalk from 'chalk';
import { Command } from 'commander';
import { SendEphemeralOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { SUCCESS_MESSAGES } from '../utils/constants';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';

export function setupSendEphemeralCommand(): Command {
  const sendEphemeralCommand = new Command('send-ephemeral')
    .description('Send an ephemeral message visible only to a specific user in a channel')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-u, --user <user>', 'User ID who will see the ephemeral message')
    .option('-m, --message <message>', 'Message to send')
    .option('-t, --thread <thread>', 'Thread timestamp to reply to')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        optionValidators.requiredChannel,
        optionValidators.requiredUser,
        optionValidators.requiredMessage,
        optionValidators.threadTimestamp,
      ])
    )
    .action(
      wrapCommand(async (options: SendEphemeralOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.sendEphemeralMessage(
          options.channel,
          options.user,
          options.message,
          options.thread
        );

        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.EPHEMERAL_MESSAGE_SENT(options.channel)}`));
      })
    );

  return sendEphemeralCommand;
}
