import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { ScheduledOptions } from '../types/commands';
import { parseFormat, parseLimit } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';

function formatPostAt(postAt: number): string {
  return new Date(postAt * 1000).toISOString();
}

function renderTable(
  messages: Array<{ id: string; channel_id: string; post_at: number; text?: string }>
) {
  const rows = messages.map((message) => ({
    id: message.id,
    channel: message.channel_id,
    post_at: formatPostAt(message.post_at),
    text: message.text || '',
  }));

  console.table(rows);
}

function renderSimple(
  messages: Array<{ id: string; channel_id: string; post_at: number; text?: string }>
) {
  for (const message of messages) {
    console.log(
      `${formatPostAt(message.post_at)} ${message.channel_id} ${message.id} ${message.text || ''}`
    );
  }
}

export function setupScheduledCommand(): Command {
  const scheduledCommand = new Command('scheduled')
    .description('List scheduled messages')
    .option('-c, --channel <channel>', 'Filter by channel name or ID')
    .option('--limit <number>', 'Maximum number of scheduled messages to list', '50')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: ScheduledOptions) => {
        const client = await createSlackClient(options.profile);
        const limit = parseLimit(options.limit, 50);
        const messages = await client.listScheduledMessages(options.channel, limit);

        if (messages.length === 0) {
          console.log('No scheduled messages found');
          return;
        }

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(messages, null, 2));
          return;
        }

        if (format === 'simple') {
          renderSimple(messages);
          return;
        }

        renderTable(messages);
      })
    );

  return scheduledCommand;
}
