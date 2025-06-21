import { Command } from 'commander';
import chalk from 'chalk';
import { SlackApiClient } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import { getConfigOrThrow } from '../utils/config-helper';
import { FileError } from '../utils/errors';
import { SendOptions } from '../types/commands';
import { extractErrorMessage } from '../utils/error-utils';
import * as fs from 'fs/promises';

export function setupSendCommand(): Command {
  const sendCommand = new Command('send')
    .description('Send a message to a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('-m, --message <message>', 'Message to send')
    .option('-f, --file <file>', 'File containing message content')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', (thisCommand) => {
      const options = thisCommand.opts();
      if (!options.message && !options.file) {
        thisCommand.error(`Error: ${ERROR_MESSAGES.NO_MESSAGE_OR_FILE}`);
      }
      if (options.message && options.file) {
        thisCommand.error(`Error: ${ERROR_MESSAGES.BOTH_MESSAGE_AND_FILE}`);
      }
    })
    .action(
      wrapCommand(async (options: SendOptions) => {
        // Get configuration
        const config = await getConfigOrThrow(options.profile);

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

        // Send message
        const client = new SlackApiClient(config.token);
        await client.sendMessage(options.channel, messageContent);

        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.MESSAGE_SENT(options.channel)}`));
      })
    );

  return sendCommand;
}
