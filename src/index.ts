#!/usr/bin/env node
import { Command } from 'commander';
import { setupConfigCommand } from './commands/config';
import { setupSendCommand } from './commands/send';
import { setupChannelsCommand } from './commands/channels';
import { setupHistoryCommand } from './commands/history';
import { setupUnreadCommand } from './commands/unread';

const program = new Command();

program.name('slack-cli').description('CLI tool to send messages via Slack API').version('1.0.0');

program.addCommand(setupConfigCommand());
program.addCommand(setupSendCommand());
program.addCommand(setupChannelsCommand());
program.addCommand(setupHistoryCommand());
program.addCommand(setupUnreadCommand());

program.parse();
