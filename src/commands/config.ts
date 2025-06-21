import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileConfigManager } from '../utils/profile-config';
import { wrapCommand, getProfileName } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';

export function configCommand(program: Command): void {
  const config = program.command('config').description('Manage Slack CLI configuration');

  config
    .command('set')
    .description('Set API token')
    .requiredOption('--token <token>', 'Slack API token')
    .option('--profile <profile>', 'Profile name (default: "default")')
    .action(
      wrapCommand(async (options) => {
        const configManager = new ProfileConfigManager();
        const profileName = await getProfileName(configManager, options.profile);
        await configManager.setToken(options.token, options.profile);
        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.TOKEN_SAVED(profileName)}`));
      })
    );

  config
    .command('get')
    .description('Show current configuration')
    .option('--profile <profile>', 'Profile name')
    .action(
      wrapCommand(async (options) => {
        const configManager = new ProfileConfigManager();
        const profileName = await getProfileName(configManager, options.profile);
        const currentConfig = await configManager.getConfig(options.profile);

        if (!currentConfig) {
          console.log(chalk.yellow(ERROR_MESSAGES.NO_CONFIG(profileName)));
          return;
        }

        console.log(chalk.bold(`Configuration for profile "${profileName}":`));
        console.log(`  Token: ${chalk.cyan(configManager.maskToken(currentConfig.token))}`);
        console.log(`  Updated: ${chalk.gray(currentConfig.updatedAt)}`);
      })
    );

  config
    .command('profiles')
    .description('List all profiles')
    .action(
      wrapCommand(async () => {
        const configManager = new ProfileConfigManager();
        const profiles = await configManager.listProfiles();
        const currentProfile = await configManager.getCurrentProfile();

        if (profiles.length === 0) {
          console.log(chalk.yellow(ERROR_MESSAGES.NO_PROFILES_FOUND));
          return;
        }

        console.log(chalk.bold('Available profiles:'));
        profiles.forEach((profile) => {
          const marker = profile.name === currentProfile ? '*' : ' ';
          const maskedToken = configManager.maskToken(profile.config.token);
          console.log(`  ${marker} ${chalk.cyan(profile.name)} (${maskedToken})`);
        });
      })
    );

  config
    .command('use <profile>')
    .description('Switch to a different profile')
    .action(
      wrapCommand(async (profile) => {
        const configManager = new ProfileConfigManager();
        await configManager.useProfile(profile);
        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_SWITCHED(profile)}`));
      })
    );

  config
    .command('current')
    .description('Show current active profile')
    .action(
      wrapCommand(async () => {
        const configManager = new ProfileConfigManager();
        const currentProfile = await configManager.getCurrentProfile();
        console.log(chalk.bold(`Current profile: ${chalk.cyan(currentProfile)}`));
      })
    );

  config
    .command('clear')
    .description('Clear configuration')
    .option('--profile <profile>', 'Profile name')
    .action(
      wrapCommand(async (options) => {
        const configManager = new ProfileConfigManager();
        const profileName = await getProfileName(configManager, options.profile);
        await configManager.clearConfig(options.profile);
        console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_CLEARED(profileName)}`));
      })
    );
}
