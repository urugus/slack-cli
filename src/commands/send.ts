import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileConfigManager } from '../utils/profile-config';
import { SlackApiClient } from '../utils/slack-api-client';
import { wrapCommand, getProfileName } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import * as fs from 'fs/promises';

export function sendCommand(program: Command): void {
  program
    .command('send')
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
      wrapCommand(async (options) => {
        // Get configuration
        const configManager = new ProfileConfigManager();
        const config = await configManager.getConfig(options.profile);

        if (!config) {
          const profileName = await getProfileName(configManager, options.profile);
          throw new Error(ERROR_MESSAGES.NO_CONFIG(profileName));
        }

        // Get message content
        let messageContent: string;
        if (options.file) {
          try {
            messageContent = await fs.readFile(options.file, 'utf-8');
          } catch (error) {
            throw new Error(`Error reading file: ${error}`);
          }
        } else {
          messageContent = options.message;
        }

        // Send message
        const client = new SlackApiClient(config.token);
        await client.sendMessage(options.channel, messageContent);

        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.MESSAGE_SENT(options.channel)}`));
      })
    );
}
