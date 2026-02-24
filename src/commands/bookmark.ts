import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { BookmarkAddOptions, BookmarkListOptions, BookmarkRemoveOptions } from '../types/commands';
import { parseFormat, parseLimit, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { createBookmarkFormatter } from '../utils/formatters/bookmark-formatters';

export function setupBookmarkCommand(): Command {
  const bookmarkCommand = new Command('bookmark').description('Manage saved items (あとで読む)');

  const addCommand = new Command('add')
    .description('Save a message for later')
    .requiredOption('-c, --channel <channel>', 'Channel ID')
    .requiredOption('--ts <timestamp>', 'Message timestamp')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: BookmarkAddOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.addStar(options.channel, options.ts);
        console.log(chalk.green(`✓ Saved message ${options.ts} in ${options.channel}`));
      })
    );

  const listCommand = new Command('list')
    .description('List saved items')
    .option('--limit <limit>', 'Number of items to display', '100')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: BookmarkListOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const limit = parseLimit(options.limit, 100);
        const result = await client.listStars(limit);

        if (result.items.length === 0) {
          console.log('No saved items found');
          return;
        }

        const format = parseFormat(options.format);
        const formatter = createBookmarkFormatter(format);
        formatter.format({ items: result.items });
      })
    );

  const removeCommand = new Command('remove')
    .description('Remove a saved item')
    .requiredOption('-c, --channel <channel>', 'Channel ID')
    .requiredOption('--ts <timestamp>', 'Message timestamp')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: BookmarkRemoveOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.removeStar(options.channel, options.ts);
        console.log(chalk.green(`✓ Removed saved item ${options.ts} from ${options.channel}`));
      })
    );

  bookmarkCommand.addCommand(addCommand);
  bookmarkCommand.addCommand(listCommand);
  bookmarkCommand.addCommand(removeCommand);

  return bookmarkCommand;
}
