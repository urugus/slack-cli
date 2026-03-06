import chalk from 'chalk';
import { Command } from 'commander';
import { PinListOptions, PinOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseFormat, parseProfile } from '../utils/option-parsers';
import { PinnedItem } from '../utils/slack-api-client';
import { sanitizeTerminalData, sanitizeTerminalText } from '../utils/terminal-sanitizer';
import { createValidationHook, optionValidators } from '../utils/validators';

function formatCreated(created: number): string {
  return new Date(created * 1000).toISOString();
}

function renderTable(items: PinnedItem[]) {
  const rows = items.map((item) => ({
    type: item.type || 'unknown',
    created: item.created ? formatCreated(item.created) : '',
    created_by: sanitizeTerminalText(item.created_by || ''),
    ts: sanitizeTerminalText(item.message?.ts || ''),
    text: sanitizeTerminalText(item.message?.text || ''),
  }));

  console.table(sanitizeTerminalData(rows));
}

function renderSimple(items: PinnedItem[]) {
  for (const item of items) {
    const created = item.created ? formatCreated(item.created) : '';
    const text = sanitizeTerminalText(item.message?.text || '');
    const ts = sanitizeTerminalText(item.message?.ts || '');
    console.log(`${created} ${ts} ${text}`);
  }
}

export function setupPinCommand(): Command {
  const pinCommand = new Command('pin').description(
    'Add, remove, or list pinned messages in a channel'
  );

  const addCommand = new Command('add')
    .description('Pin a message in a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-t, --timestamp <timestamp>', 'Message timestamp')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.pinTimestamp]))
    .action(
      wrapCommand(async (options: PinOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.addPin(options.channel, options.timestamp);
        console.log(chalk.green(`✓ Pin added to message in #${options.channel}`));
      })
    );

  const removeCommand = new Command('remove')
    .description('Unpin a message in a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-t, --timestamp <timestamp>', 'Message timestamp')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.pinTimestamp]))
    .action(
      wrapCommand(async (options: PinOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.removePin(options.channel, options.timestamp);
        console.log(chalk.green(`✓ Pin removed from message in #${options.channel}`));
      })
    );

  const listCommand = new Command('list')
    .description('List pinned items in a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: PinListOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const items = await client.listPins(options.channel);

        if (items.length === 0) {
          console.log('No pinned items found');
          return;
        }

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(sanitizeTerminalData(items), null, 2));
          return;
        }

        if (format === 'simple') {
          renderSimple(items);
          return;
        }

        renderTable(items);
      })
    );

  pinCommand.addCommand(addCommand);
  pinCommand.addCommand(removeCommand);
  pinCommand.addCommand(listCommand);

  return pinCommand;
}
