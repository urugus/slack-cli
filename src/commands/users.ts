import { Command } from 'commander';
import {
  UsersInfoOptions,
  UsersListOptions,
  UsersLookupOptions,
  UsersPresenceOptions,
} from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseFormat, parseLimit, parseProfile } from '../utils/option-parsers';
import { SlackUser, UserPresence } from '../types/slack';
import { sanitizeTerminalData, sanitizeTerminalText } from '../utils/terminal-sanitizer';
import { createValidationHook, optionValidators } from '../utils/validators';

function renderUserTable(users: SlackUser[]) {
  const rows = users.map((user) => ({
    id: sanitizeTerminalText(user.id || ''),
    name: sanitizeTerminalText(user.name || ''),
    real_name: sanitizeTerminalText(user.real_name || ''),
    email: sanitizeTerminalText(user.profile?.email || ''),
    is_bot: user.is_bot ? 'Yes' : 'No',
    deleted: user.deleted ? 'Yes' : 'No',
  }));

  console.table(sanitizeTerminalData(rows));
}

function renderUserSimple(users: SlackUser[]) {
  for (const user of users) {
    const email = user.profile?.email ? ` <${sanitizeTerminalText(user.profile.email)}>` : '';
    console.log(
      `${sanitizeTerminalText(user.id || '')}\t${sanitizeTerminalText(
        user.name || ''
      )}\t${sanitizeTerminalText(user.real_name || '')}${email}`
    );
  }
}

function renderUserInfo(user: SlackUser) {
  console.log(`ID:           ${sanitizeTerminalText(user.id || '')}`);
  console.log(`Name:         ${sanitizeTerminalText(user.name || '')}`);
  console.log(`Real Name:    ${sanitizeTerminalText(user.real_name || '')}`);
  console.log(`Display Name: ${sanitizeTerminalText(user.profile?.display_name || '')}`);
  console.log(`Email:        ${sanitizeTerminalText(user.profile?.email || '')}`);
  console.log(`Title:        ${sanitizeTerminalText(user.profile?.title || '')}`);
  console.log(
    `Timezone:     ${sanitizeTerminalText(user.tz || '')} (${sanitizeTerminalText(
      user.tz_label || ''
    )})`
  );
  console.log(
    `Status:       ${sanitizeTerminalText(user.profile?.status_emoji || '')} ${sanitizeTerminalText(
      user.profile?.status_text || ''
    )}`
  );
  console.log(`Admin:        ${user.is_admin ? 'Yes' : 'No'}`);
  console.log(`Bot:          ${user.is_bot ? 'Yes' : 'No'}`);
  console.log(`Deleted:      ${user.deleted ? 'Yes' : 'No'}`);
}

function renderPresenceTable(userId: string, presence: UserPresence) {
  const rows = [
    {
      user: sanitizeTerminalText(userId),
      presence: sanitizeTerminalText(presence.presence),
    },
  ];
  console.table(sanitizeTerminalData(rows));
}

function renderPresenceSimple(userId: string, presence: UserPresence) {
  console.log(`${sanitizeTerminalText(userId)}\t${sanitizeTerminalText(presence.presence)}`);
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
          console.log(JSON.stringify(sanitizeTerminalData(users), null, 2));
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
          console.log(JSON.stringify(sanitizeTerminalData(user), null, 2));
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
          console.log(JSON.stringify(sanitizeTerminalData(user), null, 2));
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
          console.log(JSON.stringify(sanitizeTerminalData(presence), null, 2));
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
