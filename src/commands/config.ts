import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import {
  handleSetToken,
  handleGetConfig,
  handleListProfiles,
  handleUseProfile,
  handleShowCurrentProfile,
  handleClearConfig,
} from './config-subcommands';

export function setupConfigCommand(): Command {
  const config = new Command('config').description('Manage Slack CLI configuration');

  config
    .command('set')
    .description('Set API token')
    .requiredOption('--token <token>', 'Slack API token')
    .option('--profile <profile>', 'Profile name (default: "default")')
    .action(wrapCommand(handleSetToken));

  config
    .command('get')
    .description('Show current configuration')
    .option('--profile <profile>', 'Profile name')
    .action(wrapCommand(handleGetConfig));

  config
    .command('profiles')
    .description('List all profiles')
    .action(wrapCommand(handleListProfiles));

  config
    .command('use <profile>')
    .description('Switch to a different profile')
    .action(wrapCommand(handleUseProfile));

  config
    .command('current')
    .description('Show current active profile')
    .action(wrapCommand(handleShowCurrentProfile));

  config
    .command('clear')
    .description('Clear configuration')
    .option('--profile <profile>', 'Profile name')
    .action(wrapCommand(handleClearConfig));

  return config;
}
