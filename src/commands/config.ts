import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config';

export function configCommand(program: Command): void {
  const config = program.command('config').description('Manage Slack CLI configuration');

  config
    .command('set')
    .description('Set API token')
    .requiredOption('--token <token>', 'Slack API token')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        await configManager.setToken(options.token);
        console.log(chalk.green('✓ Token saved successfully'));
      } catch (error) {
        console.error(chalk.red('✗ Error saving token:'), error);
        process.exit(1);
      }
    });

  config
    .command('get')
    .description('Show current configuration')
    .action(async () => {
      try {
        const configManager = new ConfigManager();
        const currentConfig = await configManager.getConfig();

        if (!currentConfig) {
          console.log(
            chalk.yellow(
              'No configuration found. Use "slack-cli config set --token <token>" to set up.'
            )
          );
          return;
        }

        console.log(chalk.bold('Current configuration:'));
        console.log(`  Token: ${chalk.cyan(configManager.maskToken(currentConfig.token))}`);
        console.log(`  Updated: ${chalk.gray(currentConfig.updatedAt)}`);
      } catch (error) {
        console.error(chalk.red('✗ Error reading configuration:'), error);
        process.exit(1);
      }
    });

  config
    .command('clear')
    .description('Clear configuration')
    .action(async () => {
      try {
        const configManager = new ConfigManager();
        await configManager.clearConfig();
        console.log(chalk.green('✓ Configuration cleared successfully'));
      } catch (error) {
        console.error(chalk.red('✗ Error clearing configuration:'), error);
        process.exit(1);
      }
    });
}
