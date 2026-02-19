import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { SearchOptions } from '../types/commands';
import { API_LIMITS } from '../utils/constants';
import { parseCount, parseProfile, parseFormat } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { createSearchFormatter } from '../utils/formatters/search-formatters';

export function setupSearchCommand(): Command {
  const searchCommand = new Command('search')
    .description('Search messages in Slack workspace')
    .requiredOption('-q, --query <query>', 'Search query')
    .option('--sort <sort>', 'Sort by: score or timestamp', 'score')
    .option('--sort-dir <direction>', 'Sort direction: asc or desc', 'desc')
    .option('-n, --number <count>', 'Number of results per page (1-100)')
    .option('--page <page>', 'Page number (1-100)')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        optionValidators.searchSort,
        optionValidators.searchSortDir,
        optionValidators.searchCount,
        optionValidators.searchPage,
        optionValidators.format,
      ])
    )
    .action(
      wrapCommand(async (options: SearchOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const count = parseCount(
          options.number,
          API_LIMITS.DEFAULT_SEARCH_COUNT,
          API_LIMITS.MIN_SEARCH_COUNT,
          API_LIMITS.MAX_SEARCH_COUNT
        );

        const page = parseCount(
          options.page,
          API_LIMITS.MIN_SEARCH_PAGE,
          API_LIMITS.MIN_SEARCH_PAGE,
          API_LIMITS.MAX_SEARCH_PAGE
        );

        const result = await client.searchMessages(options.query, {
          sort: (options.sort as 'score' | 'timestamp') || 'score',
          sortDir: (options.sortDir as 'asc' | 'desc') || 'desc',
          count,
          page,
        });

        const format = parseFormat(options.format);
        const formatter = createSearchFormatter(format);
        formatter.format({
          query: result.query,
          matches: result.matches,
          totalCount: result.totalCount,
          page: result.page,
          pageCount: result.pageCount,
        });
      })
    );

  return searchCommand;
}
