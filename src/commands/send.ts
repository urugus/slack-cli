import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import { createSlackClient } from '../utils/client-factory';
import { FileError } from '../utils/errors';
import { SendOptions } from '../types/commands';
import { extractErrorMessage } from '../utils/error-utils';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { resolvePostAt } from '../utils/schedule-utils';
import * as fs from 'fs/promises';

export function setupSendCommand(): Command {
  const sendCommand = new Command('send')
    .description('Send or schedule a message to a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('-m, --message <message>', 'Message to send')
    .option('-f, --file <file>', 'File containing message content')
    .option('-t, --thread <thread>', 'Thread timestamp to reply to')
    .option('--at <time>', 'Schedule time (Unix timestamp in seconds or ISO 8601)')
    .option('--after <minutes>', 'Schedule message after N minutes')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        optionValidators.messageOrFile,
        optionValidators.threadTimestamp,
        optionValidators.scheduleTiming,
      ])
    )
    .action(
      wrapCommand(async (options: SendOptions) => {
        // Get message content
        let messageContent: string;
        if (options.file) {
          try {
            messageContent = await fs.readFile(options.file, 'utf-8');
          } catch (error) {
            throw new FileError(
              ERROR_MESSAGES.FILE_READ_ERROR(options.file, extractErrorMessage(error))
            );
          }
        } else {
          messageContent = options.message!; // This is safe because of preAction validation
        }

        const postAt = resolvePostAt(options.at, options.after);

        // Send message
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        if (postAt !== null) {
          await client.scheduleMessage(options.channel, messageContent, postAt, options.thread);
          const postAtIso = new Date(postAt * 1000).toISOString();
          console.log(
            chalk.green(`✓ ${SUCCESS_MESSAGES.MESSAGE_SCHEDULED(options.channel, postAtIso)}`)
          );
          return;
        }

        await client.sendMessage(options.channel, messageContent, options.thread);
        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.MESSAGE_SENT(options.channel)}`));
      })
    );

  return sendCommand;
}
