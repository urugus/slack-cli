#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { setupBookmarkCommand } from './commands/bookmark';
import { setupCanvasCommand } from './commands/canvas';
import { setupChannelCommand } from './commands/channel';
import { setupChannelsCommand } from './commands/channels';
import { setupConfigCommand } from './commands/config';
import { setupDeleteCommand } from './commands/delete';
import { setupEditCommand } from './commands/edit';
import { setupHistoryCommand } from './commands/history';
import { setupInviteCommand } from './commands/invite';
import { setupJoinCommand } from './commands/join';
import { setupLeaveCommand } from './commands/leave';
import { setupMembersCommand } from './commands/members';
import { setupPinCommand } from './commands/pin';
import { setupReactionCommand } from './commands/reaction';
import { setupReminderCommand } from './commands/reminder';
import { setupScheduledCommand } from './commands/scheduled';
import { setupSearchCommand } from './commands/search';
import { setupSendCommand } from './commands/send';
import { setupSendEphemeralCommand } from './commands/send-ephemeral';
import { setupUnreadCommand } from './commands/unread';
import { setupUploadCommand } from './commands/upload';
import { setupUsersCommand } from './commands/users';
import { checkForUpdates } from './utils/update-notifier';

const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as {
  name: string;
  version: string;
};

export function createProgram(): Command {
  const program = new Command();

  program
    .name('slack-cli')
    .description('CLI tool to send messages via Slack API')
    .version(packageJson.version);

  program.hook('postAction', async () => {
    await checkForUpdates({
      packageName: packageJson.name,
      currentVersion: packageJson.version,
    });
  });

  program.addCommand(setupConfigCommand());
  program.addCommand(setupSendCommand());
  program.addCommand(setupChannelsCommand());
  program.addCommand(setupHistoryCommand());
  program.addCommand(setupUnreadCommand());
  program.addCommand(setupScheduledCommand());
  program.addCommand(setupSearchCommand());
  program.addCommand(setupEditCommand());
  program.addCommand(setupDeleteCommand());
  program.addCommand(setupUploadCommand());
  program.addCommand(setupReactionCommand());
  program.addCommand(setupPinCommand());
  program.addCommand(setupUsersCommand());
  program.addCommand(setupChannelCommand());
  program.addCommand(setupMembersCommand());
  program.addCommand(setupSendEphemeralCommand());
  program.addCommand(setupJoinCommand());
  program.addCommand(setupLeaveCommand());
  program.addCommand(setupInviteCommand());
  program.addCommand(setupReminderCommand());
  program.addCommand(setupBookmarkCommand());
  program.addCommand(setupCanvasCommand());

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (require.main === module) {
  void runCli();
}
