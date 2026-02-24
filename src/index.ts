#!/usr/bin/env node
import { Command } from 'commander';
import { setupConfigCommand } from './commands/config';
import { setupSendCommand } from './commands/send';
import { setupChannelsCommand } from './commands/channels';
import { setupHistoryCommand } from './commands/history';
import { setupUnreadCommand } from './commands/unread';
import { setupScheduledCommand } from './commands/scheduled';
import { setupSearchCommand } from './commands/search';
import { setupEditCommand } from './commands/edit';
import { setupDeleteCommand } from './commands/delete';
import { setupUploadCommand } from './commands/upload';
import { setupReactionCommand } from './commands/reaction';
import { setupPinCommand } from './commands/pin';
import { setupUsersCommand } from './commands/users';
import { setupChannelCommand } from './commands/channel';
import { setupMembersCommand } from './commands/members';
import { setupSendEphemeralCommand } from './commands/send-ephemeral';
import { readFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const version = packageJson.version;

program.name('slack-cli').description('CLI tool to send messages via Slack API').version(version);

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

program.parse();
