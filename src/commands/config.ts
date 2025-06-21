import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileConfigManager } from '../utils/profile-config';

export function configCommand(program: Command): void {
  const config = program.command('config').description('Manage Slack CLI configuration');

  config
    .command('set')
    .description('Set API token')
    .requiredOption('--token <token>', 'Slack API token')
    .option('--profile <profile>', 'Profile name (default: "default")')
    .action(async (options) => {
      try {
        const configManager = new ProfileConfigManager();
        await configManager.setToken(options.token, options.profile);
        const profileName = options.profile || (await configManager.getCurrentProfile());
        console.log(chalk.green(`✓ Token saved successfully for profile "${profileName}"`));
      } catch (error) {
        console.error(chalk.red('✗ Error saving token:'), error);
        process.exit(1);
      }
    });

  config
    .command('get')
    .description('Show current configuration')
    .option('--profile <profile>', 'Profile name')
    .action(async (options) => {
      try {
        const configManager = new ProfileConfigManager();
        const profileName = options.profile || (await configManager.getCurrentProfile());
        const currentConfig = await configManager.getConfig(options.profile);

        if (!currentConfig) {
          console.log(
            chalk.yellow(
              `No configuration found for profile "${profileName}". Use "slack-cli config set --token <token> --profile ${profileName}" to set up.`
            )
          );
          return;
        }

        console.log(chalk.bold(`Configuration for profile "${profileName}":`));
        console.log(`  Token: ${chalk.cyan(configManager.maskToken(currentConfig.token))}`);
        console.log(`  Updated: ${chalk.gray(currentConfig.updatedAt)}`);
      } catch (error) {
        console.error(chalk.red('✗ Error reading configuration:'), error);
        process.exit(1);
      }
    });

  config
    .command('profiles')
    .description('List all profiles')
    .action(async () => {
      try {
        const configManager = new ProfileConfigManager();
        const profiles = await configManager.listProfiles();
        const currentProfile = await configManager.getCurrentProfile();

        if (profiles.length === 0) {
          console.log(
            chalk.yellow(
              'No profiles found. Use "slack-cli config set --token <token>" to create one.'
            )
          );
          return;
        }

        console.log(chalk.bold('Available profiles:'));
        profiles.forEach((profile) => {
          const marker = profile.name === currentProfile ? '*' : ' ';
          const maskedToken = configManager.maskToken(profile.config.token);
          console.log(`  ${marker} ${chalk.cyan(profile.name)} (${maskedToken})`);
        });
      } catch (error) {
        console.error(chalk.red('✗ Error listing profiles:'), error);
        process.exit(1);
      }
    });

  config
    .command('use <profile>')
    .description('Switch to a different profile')
    .action(async (profile) => {
      try {
        const configManager = new ProfileConfigManager();
        await configManager.useProfile(profile);
        console.log(chalk.green(`✓ Switched to profile "${profile}"`));
      } catch (error) {
        console.error(chalk.red('✗ Error switching profile:'), error);
        process.exit(1);
      }
    });

  config
    .command('current')
    .description('Show current active profile')
    .action(async () => {
      try {
        const configManager = new ProfileConfigManager();
        const currentProfile = await configManager.getCurrentProfile();
        console.log(chalk.bold(`Current profile: ${chalk.cyan(currentProfile)}`));
      } catch (error) {
        console.error(chalk.red('✗ Error getting current profile:'), error);
        process.exit(1);
      }
    });

  config
    .command('clear')
    .description('Clear configuration')
    .option('--profile <profile>', 'Profile name')
    .action(async (options) => {
      try {
        const configManager = new ProfileConfigManager();
        const profileName = options.profile || (await configManager.getCurrentProfile());
        await configManager.clearConfig(options.profile);
        console.log(chalk.green(`✓ Profile "${profileName}" cleared successfully`));
      } catch (error) {
        console.error(chalk.red('✗ Error clearing configuration:'), error);
        process.exit(1);
      }
    });
}
