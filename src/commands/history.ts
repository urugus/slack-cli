import { Command } from 'commander';
import { HistoryOptions } from '../types/commands';
import { HistoryOptions as ApiHistoryOptions, Message } from '../types/slack';
import { withSlackClient } from '../utils/command-support';
import { wrapCommand } from '../utils/command-wrapper';
import { API_LIMITS } from '../utils/constants';
import { parseCount, parseFormat } from '../utils/option-parsers';
import { parseSlackMessageUrl } from '../utils/slack-message-url';
import { displaySlackTables, parseTableOutputFormat } from '../utils/slack-table-blocks';
import { createValidationHook, optionValidators } from '../utils/validators';
import { displayHistoryResults } from './history-display';
import { prepareSinceTimestamp } from './history-validators';

export function setupHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('Get message history from a Slack channel')
    .option('--url <url>', 'Slack message permalink to retrieve')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-n, --number <number>', 'Number of messages to retrieve')
    .option('--since <date>', 'Get messages since specific date (YYYY-MM-DD HH:MM:SS)')
    .option('-t, --thread <thread>', 'Thread timestamp to retrieve complete thread conversation')
    .option('--with-link', 'Include permalink URL for each message', false)
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--tables', 'Extract table blocks from retrieved messages', false)
    .option('--table-format <format>', 'Table output format: markdown, json, tsv', 'markdown')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        validateHistorySource,
        validateSlackMessageUrl,
        validateTableFormat,
        (options) => (options.thread ? null : optionValidators.messageCount(options)),
        (options) => (options.thread ? null : optionValidators.sinceDate(options)),
        (options) => (options.url ? null : optionValidators.threadTimestamp(options)),
        optionValidators.format,
      ])
    )
    .action(
      wrapCommand(async (options: HistoryOptions) => {
        await withSlackClient(options, async (client) => {
          const limit = parseCount(
            options.number,
            API_LIMITS.DEFAULT_MESSAGE_COUNT,
            API_LIMITS.MIN_MESSAGE_COUNT,
            API_LIMITS.MAX_MESSAGE_COUNT
          );

          let messages: Message[];
          let users: Map<string, string>;
          let channelName: string;
          let preserveOrder = false;

          if (options.url) {
            const source = parseSlackMessageUrl(options.url);
            messages = [await client.getMessage(source.channel, source.messageTs, source.threadTs)];
            users = new Map();
            channelName = source.channel;
            preserveOrder = true;
          } else if (options.thread) {
            if (options.number !== undefined) {
              console.log('Warning: --number is ignored when --thread is specified.');
            }
            if (options.since !== undefined) {
              console.log('Warning: --since is ignored when --thread is specified.');
            }
            ({ messages, users } = await client.getThreadHistory(options.channel!, options.thread));
            channelName = options.channel!;
            preserveOrder = true;
          } else {
            const historyOptions: ApiHistoryOptions = {
              limit,
            };

            const oldest = prepareSinceTimestamp(options.since);
            if (oldest) {
              historyOptions.oldest = oldest;
            }

            ({ messages, users } = await client.getHistory(options.channel!, historyOptions));
            channelName = options.channel!;
          }

          if (options.tables) {
            const orderedMessages = preserveOrder ? messages : [...messages].reverse();
            displaySlackTables(orderedMessages, parseTableOutputFormat(options.tableFormat));
            return;
          }

          let permalinks: Map<string, string> | undefined;
          if (options.withLink && messages.length > 0) {
            try {
              permalinks = await client.getPermalinks(
                channelName,
                messages.map((m) => m.ts)
              );
            } catch {
              // Degrade gracefully: show history without links
            }
          }

          const format = parseFormat(options.format);
          displayHistoryResults(messages, users, channelName, format, {
            preserveOrder,
            permalinks,
          });
        });
      })
    );

  return historyCommand;
}

function validateHistorySource(options: Record<string, unknown>): string | null {
  if (options.url && options.channel) {
    return 'Cannot use --url with --channel';
  }

  if (options.url && (options.number || options.since || options.thread)) {
    return 'Cannot use --url with --number, --since, or --thread';
  }

  if (!options.url && !options.channel) {
    return '--channel is required unless --url is specified';
  }

  return null;
}

function validateSlackMessageUrl(options: Record<string, unknown>): string | null {
  if (!options.url) {
    return null;
  }

  try {
    parseSlackMessageUrl(options.url as string);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid Slack message URL';
  }
}

function validateTableFormat(options: Record<string, unknown>): string | null {
  try {
    parseTableOutputFormat(options.tableFormat as string | undefined);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid table format';
  }
}
