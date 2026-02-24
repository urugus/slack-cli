import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import {
  ReminderAddOptions,
  ReminderListOptions,
  ReminderDeleteOptions,
  ReminderCompleteOptions,
} from '../types/commands';
import { parseFormat, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { createReminderFormatter } from '../utils/formatters/reminder-formatters';
import { resolvePostAt } from '../utils/schedule-utils';

export function setupReminderCommand(): Command {
  const reminderCommand = new Command('reminder').description(
    'Create, list, delete, or complete reminders'
  );

  const addCommand = new Command('add')
    .description('Create a new reminder')
    .requiredOption('--text <text>', 'The content of the reminder')
    .option('--at <datetime>', 'Absolute date/time (e.g. "2024-03-01 15:00")')
    .option('--after <minutes>', 'Minutes from now')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.reminderTiming]))
    .action(
      wrapCommand(async (options: ReminderAddOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const time = resolvePostAt(options.at, options.after);
        if (time === null) {
          throw new Error('Could not resolve reminder time. Use --at or --after option.');
        }

        const reminder = await client.addReminder(options.text, time);
        const timeStr = new Date(reminder.time * 1000).toISOString();
        console.log(chalk.green(`✓ Reminder created: "${reminder.text}" at ${timeStr}`));
      })
    );

  const listCommand = new Command('list')
    .description('List all reminders')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: ReminderListOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        const reminders = await client.listReminders();

        if (reminders.length === 0) {
          console.log('No reminders found');
          return;
        }

        const format = parseFormat(options.format);
        const formatter = createReminderFormatter(format);
        formatter.format({ reminders });
      })
    );

  const deleteCommand = new Command('delete')
    .description('Delete a reminder')
    .requiredOption('--id <reminderId>', 'Reminder ID')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: ReminderDeleteOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.deleteReminder(options.id);
        console.log(chalk.green(`✓ Reminder deleted: ${options.id}`));
      })
    );

  const completeCommand = new Command('complete')
    .description('Mark a reminder as complete')
    .requiredOption('--id <reminderId>', 'Reminder ID')
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: ReminderCompleteOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        await client.completeReminder(options.id);
        console.log(chalk.green(`✓ Reminder completed: ${options.id}`));
      })
    );

  reminderCommand.addCommand(addCommand);
  reminderCommand.addCommand(listCommand);
  reminderCommand.addCommand(deleteCommand);
  reminderCommand.addCommand(completeCommand);

  return reminderCommand;
}
