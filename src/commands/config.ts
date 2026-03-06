import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import {
  handleClearConfig,
  handleGetConfig,
  handleListProfiles,
  handleSetToken,
  handleShowCurrentProfile,
  handleUseProfile,
} from './config-subcommands';

export function setupConfigCommand(): Command {
  const config = new Command('config').description('Manage Slack CLI configuration');

  config
    .command('set')
    .description('Set API token')
    .option(
      '--token <token>',
      'Slack API token (deprecated: may leak via shell history/process list)'
    )
    .option('--token-stdin', 'Read Slack API token from stdin')
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
