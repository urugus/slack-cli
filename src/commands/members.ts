import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { MembersOptions } from '../types/commands';
import { parseFormat, parseLimit, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { createMembersFormatter, MemberInfo } from '../utils/formatters/members-formatters';

export function setupMembersCommand(): Command {
  const membersCommand = new Command('members');

  membersCommand
    .description('List channel members')
    .requiredOption('-c, --channel <channel>', 'Target channel name or ID')
    .option('--limit <number>', 'Maximum number of members to list', '100')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: MembersOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const limit = parseLimit(options.limit, 100);

        const result = await client.getChannelMembers(options.channel, { limit });

        if (result.members.length === 0) {
          console.log('No members found');
          return;
        }

        // Resolve user names for each member
        const memberInfos: MemberInfo[] = await Promise.all(
          result.members.map(async (userId) => {
            try {
              const user = await client.getUserInfo(userId);
              return {
                id: userId,
                name: user.name,
                realName: user.real_name,
              };
            } catch {
              // If user lookup fails, return ID only
              return {
                id: userId,
                name: undefined,
                realName: undefined,
              };
            }
          })
        );

        const format = parseFormat(options.format);
        const formatter = createMembersFormatter(format);
        formatter.format({ members: memberInfos });
      })
    );

  return membersCommand;
}
