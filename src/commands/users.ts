import { Command } from 'commander';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import {
  UsersListOptions,
  UsersInfoOptions,
  UsersLookupOptions,
  UsersPresenceOptions,
} from '../types/commands';
import { parseFormat, parseLimit, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { SlackUser, UserPresence } from '../utils/slack-api-client';

function renderUserTable(users: SlackUser[]) {
  const rows = users.map((user) => ({
    id: user.id || '',
    name: user.name || '',
    real_name: user.real_name || '',
    email: user.profile?.email || '',
    is_bot: user.is_bot ? 'Yes' : 'No',
    deleted: user.deleted ? 'Yes' : 'No',
  }));

  console.table(rows);
}

function renderUserSimple(users: SlackUser[]) {
  for (const user of users) {
    const email = user.profile?.email ? ` <${user.profile.email}>` : '';
    console.log(`${user.id || ''}\t${user.name || ''}\t${user.real_name || ''}${email}`);
  }
}

function renderUserInfo(user: SlackUser) {
  console.log(`ID:           ${user.id || ''}`);
  console.log(`Name:         ${user.name || ''}`);
  console.log(`Real Name:    ${user.real_name || ''}`);
  console.log(`Display Name: ${user.profile?.display_name || ''}`);
  console.log(`Email:        ${user.profile?.email || ''}`);
  console.log(`Title:        ${user.profile?.title || ''}`);
  console.log(`Timezone:     ${user.tz || ''} (${user.tz_label || ''})`);
  console.log(
    `Status:       ${user.profile?.status_emoji || ''} ${user.profile?.status_text || ''}`
  );
  console.log(`Admin:        ${user.is_admin ? 'Yes' : 'No'}`);
  console.log(`Bot:          ${user.is_bot ? 'Yes' : 'No'}`);
  console.log(`Deleted:      ${user.deleted ? 'Yes' : 'No'}`);
}

function renderPresenceTable(userId: string, presence: UserPresence) {
  const rows = [
    {
      user: userId,
      presence: presence.presence,
    },
  ];
  console.table(rows);
}

function renderPresenceSimple(userId: string, presence: UserPresence) {
  console.log(`${userId}\t${presence.presence}`);
}

export function setupUsersCommand(): Command {
  const usersCommand = new Command('users').description(
    'List, search, and get information about workspace users'
  );

  const listCommand = new Command('list')
    .description('List workspace users')
    .option('--limit <number>', 'Maximum number of users to list', '100')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: UsersListOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const limit = parseLimit(options.limit, 100);
        const users = await client.listUsers(limit);

        if (users.length === 0) {
          console.log('No users found');
          return;
        }

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(users, null, 2));
          return;
        }

        if (format === 'simple') {
          renderUserSimple(users);
          return;
        }

        renderUserTable(users);
      })
    );

  const infoCommand = new Command('info')
    .description('Get detailed information about a user')
    .requiredOption('--id <userId>', 'User ID')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: UsersInfoOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const user = await client.getUserInfo(options.id);

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(user, null, 2));
          return;
        }

        renderUserInfo(user);
      })
    );

  const lookupCommand = new Command('lookup')
    .description('Look up a user by email address')
    .requiredOption('--email <email>', 'Email address to look up')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: UsersLookupOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const user = await client.lookupUserByEmail(options.email);

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(user, null, 2));
          return;
        }

        renderUserInfo(user);
      })
    );

  const presenceCommand = new Command('presence')
    .description('Check user presence status (active/away)')
    .option('--id <userId>', 'User ID')
    .option('--name <username>', 'Username (e.g. @username)')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: UsersPresenceOptions) => {
        if (!options.id && !options.name) {
          throw new Error('You must specify either --id or --name');
        }
        if (options.id && options.name) {
          throw new Error('Cannot use both --id and --name');
        }

        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        let userId: string;
        if (options.name) {
          userId = await client.resolveUserIdByName(options.name);
        } else {
          userId = options.id!;
        }

        const presence = await client.getUserPresence(userId);

        const format = parseFormat(options.format);

        if (format === 'json') {
          console.log(JSON.stringify(presence, null, 2));
          return;
        }

        if (format === 'simple') {
          renderPresenceSimple(userId, presence);
          return;
        }

        renderPresenceTable(userId, presence);
      })
    );

  usersCommand.addCommand(listCommand);
  usersCommand.addCommand(infoCommand);
  usersCommand.addCommand(lookupCommand);
  usersCommand.addCommand(presenceCommand);

  return usersCommand;
}
