import chalk from 'chalk';
import { Command } from 'commander';
import { ReactionOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';

export function setupReactionCommand(): Command {
  const reactionCommand = new Command('reaction').description(
    'Add or remove emoji reactions on messages'
  );

  const addCommand = new Command('add')
    .description('Add a reaction to a message')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-t, --timestamp <timestamp>', 'Message timestamp')
    .requiredOption('-e, --emoji <emoji>', 'Emoji name (without colons)')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.reactionTimestamp]))
    .action(
      wrapCommand(async (options: ReactionOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.addReaction(options.channel, options.timestamp, options.emoji);
        console.log(
          chalk.green(`✓ Reaction :${options.emoji}: added to message in #${options.channel}`)
        );
      })
    );

  const removeCommand = new Command('remove')
    .description('Remove a reaction from a message')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-t, --timestamp <timestamp>', 'Message timestamp')
    .requiredOption('-e, --emoji <emoji>', 'Emoji name (without colons)')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.reactionTimestamp]))
    .action(
      wrapCommand(async (options: ReactionOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.removeReaction(options.channel, options.timestamp, options.emoji);
        console.log(
          chalk.green(`✓ Reaction :${options.emoji}: removed from message in #${options.channel}`)
        );
      })
    );

  reactionCommand.addCommand(addCommand);
  reactionCommand.addCommand(removeCommand);

  return reactionCommand;
}
