import { Command } from 'commander';
import { HistoryOptions as ApiHistoryOptions } from '../utils/slack-api-client';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { HistoryOptions } from '../types/commands';
import { API_LIMITS } from '../utils/constants';
import { parseCount, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { prepareSinceTimestamp } from './history-validators';
import { displayHistoryResults } from './history-display';

export function setupHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('Get message history from a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option(
      '-n, --number <number>',
      'Number of messages to retrieve',
      API_LIMITS.DEFAULT_MESSAGE_COUNT.toString()
    )
    .option('--since <date>', 'Get messages since specific date (YYYY-MM-DD HH:MM:SS)')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([optionValidators.messageCount, optionValidators.sinceDate])
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

        const historyOptions: ApiHistoryOptions = {
          limit,
        };

        const oldest = prepareSinceTimestamp(options.since);
        if (oldest) {
          historyOptions.oldest = oldest;
        }

        const { messages, users } = await client.getHistory(options.channel, historyOptions);
        displayHistoryResults(messages, users, options.channel);
      })
    );

  return historyCommand;
}
