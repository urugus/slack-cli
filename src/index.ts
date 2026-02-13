#!/usr/bin/env node
import { Command } from 'commander';
import { setupConfigCommand } from './commands/config';
import { setupSendCommand } from './commands/send';
import { setupChannelsCommand } from './commands/channels';
import { setupHistoryCommand } from './commands/history';
import { setupUnreadCommand } from './commands/unread';
import { setupScheduledCommand } from './commands/scheduled';
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

program.parse();
