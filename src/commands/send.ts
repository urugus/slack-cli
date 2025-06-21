import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileConfigManager } from '../utils/profile-config';
import { SlackApiClient } from '../utils/slack-api-client';
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
        thisCommand.error('Error: You must specify either --message or --file');
      }
      if (options.message && options.file) {
        thisCommand.error('Error: Cannot use both --message and --file');
      }
    })
    .action(async (options) => {
      try {
        // Get configuration
        const configManager = new ProfileConfigManager();
        const config = await configManager.getConfig(options.profile);

        if (!config) {
          const profileName = options.profile || (await configManager.getCurrentProfile());
          console.error(
            chalk.red(
              `✗ No configuration found for profile "${profileName}". Use "slack-cli config set --token <token> --profile ${profileName}" to set up.`
            )
          );
          process.exit(1);
        }

        // Get message content
        let messageContent: string;
        if (options.file) {
          try {
            messageContent = await fs.readFile(options.file, 'utf-8');
          } catch (error) {
            console.error(chalk.red(`✗ Error reading file: ${error}`));
            process.exit(1);
          }
        } else {
          messageContent = options.message;
        }

        // Send message
        const client = new SlackApiClient(config.token);
        await client.sendMessage(options.channel, messageContent);

        console.log(chalk.green(`✓ Message sent successfully to #${options.channel}`));
      } catch (error) {
        console.error(chalk.red('✗ Error sending message:'), error);
        process.exit(1);
      }
    });
}
