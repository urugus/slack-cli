import { Command } from 'commander';
import { HistoryOptions as ApiHistoryOptions, Message } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { HistoryOptions } from '../types/commands';
import { API_LIMITS } from '../utils/constants';
import { parseCount, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { parseFormat } from '../utils/option-parsers';
import { prepareSinceTimestamp } from './history-validators';
import { displayHistoryResults } from './history-display';

export function setupHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('Get message history from a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('-n, --number <number>', 'Number of messages to retrieve')
    .option('--since <date>', 'Get messages since specific date (YYYY-MM-DD HH:MM:SS)')
    .option('-t, --thread <thread>', 'Thread timestamp to retrieve complete thread conversation')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        optionValidators.messageCount,
        optionValidators.sinceDate,
        optionValidators.threadTimestamp,
        optionValidators.format,
      ])
    )
    .action(
      wrapCommand(async (options: HistoryOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const limit = parseCount(
          options.number,
          API_LIMITS.DEFAULT_MESSAGE_COUNT,
          API_LIMITS.MIN_MESSAGE_COUNT,
          API_LIMITS.MAX_MESSAGE_COUNT
        );

        let messages: Message[];
        let users: Map<string, string>;
        if (options.thread) {
          if (options.number !== undefined) {
            console.log('Warning: --number is ignored when --thread is specified.');
          }
          if (options.since !== undefined) {
            console.log('Warning: --since is ignored when --thread is specified.');
          }
          ({ messages, users } = await client.getThreadHistory(options.channel, options.thread));
        } else {
          const historyOptions: ApiHistoryOptions = {
            limit,
          };

          const oldest = prepareSinceTimestamp(options.since);
          if (oldest) {
            historyOptions.oldest = oldest;
          }

          ({ messages, users } = await client.getHistory(options.channel, historyOptions));
        }
        const format = parseFormat(options.format);
        displayHistoryResults(messages, users, options.channel, format);
      })
    );

  return historyCommand;
}
