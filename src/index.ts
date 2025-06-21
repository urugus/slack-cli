#!/usr/bin/env node
import { Command } from 'commander';
import { configCommand } from './commands/config';
import { sendCommand } from './commands/send';

const program = new Command();

program.name('slack-cli').description('CLI tool to send messages via Slack API').version('1.0.0');

configCommand(program);
sendCommand(program);

program.parse();
