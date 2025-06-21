import { Command } from 'commander';
import chalk from 'chalk';
import { SlackApiClient, HistoryOptions as ApiHistoryOptions } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';
import { getConfigOrThrow } from '../utils/config-helper';
import { HistoryOptions } from '../types/commands';

export function setupHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('Get message history from a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('-n, --number <number>', 'Number of messages to retrieve', '10')
    .option('--since <date>', 'Get messages since specific date (YYYY-MM-DD HH:MM:SS)')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', (thisCommand) => {
      const options = thisCommand.opts();

      // Validate number option
      if (options.number) {
        const num = parseInt(options.number, 10);
        if (isNaN(num) || num < 1 || num > 1000) {
          thisCommand.error('Error: Message count must be between 1 and 1000');
        }
      }

      // Validate since option
      if (options.since) {
        const timestamp = Date.parse(options.since);
        if (isNaN(timestamp)) {
          thisCommand.error('Error: Invalid date format. Use YYYY-MM-DD HH:MM:SS');
        }
      }
    })
    .action(
      wrapCommand(async (options: HistoryOptions) => {
        // Get configuration
        const config = await getConfigOrThrow(options.profile);

        // Prepare API options
        const historyOptions: ApiHistoryOptions = {
          limit: parseInt(options.number || '10', 10),
        };

        if (options.since) {
          // Convert date to Unix timestamp (in seconds)
          const timestamp = Math.floor(Date.parse(options.since) / 1000);
          historyOptions.oldest = timestamp.toString();
        }

        // Get message history
        const client = new SlackApiClient(config.token);
        const { messages, users } = await client.getHistory(options.channel, historyOptions);

        // Display results
        if (messages.length === 0) {
          console.log(chalk.yellow('No messages found in the specified channel.'));
          return;
        }

        console.log(chalk.bold(`\nMessage History for #${options.channel}:\n`));

        // Display messages in reverse order (oldest first)
        messages.reverse().forEach((message) => {
          const timestamp = new Date(parseFloat(message.ts) * 1000).toLocaleString();
          let author = 'Unknown';

          if (message.user && users.has(message.user)) {
            author = users.get(message.user)!;
          } else if (message.bot_id) {
            author = 'Bot';
          }

          console.log(chalk.gray(`[${timestamp}]`) + ' ' + chalk.cyan(author));
          if (message.text) {
            console.log(message.text);
          }
          console.log(''); // Empty line between messages
        });

        console.log(chalk.green(`✓ Displayed ${messages.length} message(s)`));
      })
    );

  return historyCommand;
}
