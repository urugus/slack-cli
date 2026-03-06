import { sanitizeTerminalText } from '../terminal-sanitizer';
import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';

export interface ReminderInfo {
  id: string;
  text: string;
  time: number;
  complete_ts: number;
  recurring: boolean;
}

export interface ReminderFormatterOptions {
  reminders: ReminderInfo[];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

function getStatus(completeTs: number): string {
  return completeTs > 0 ? 'completed' : 'pending';
}

class ReminderTableFormatter extends AbstractFormatter<ReminderFormatterOptions> {
  format({ reminders }: ReminderFormatterOptions): void {
    const idWidth = 14;
    const textWidth = 30;
    const timeWidth = 26;
    const statusWidth = 10;

    const header =
      'ID'.padEnd(idWidth) +
      'Text'.padEnd(textWidth) +
      'Time'.padEnd(timeWidth) +
      'Status'.padEnd(statusWidth);
    console.log(header);
    console.log('\u2500'.repeat(idWidth + textWidth + timeWidth + statusWidth));

    reminders.forEach((reminder) => {
      const id = sanitizeTerminalText(reminder.id || '').padEnd(idWidth);
      const text = sanitizeTerminalText(reminder.text || '')
        .slice(0, textWidth - 2)
        .padEnd(textWidth);
      const time = formatTime(reminder.time).padEnd(timeWidth);
      const status = getStatus(reminder.complete_ts).padEnd(statusWidth);

      console.log(`${id}${text}${time}${status}`);
    });
  }
}

class ReminderSimpleFormatter extends AbstractFormatter<ReminderFormatterOptions> {
  format({ reminders }: ReminderFormatterOptions): void {
    reminders.forEach((reminder) => {
      const time = formatTime(reminder.time);
      const status = getStatus(reminder.complete_ts);
      console.log(
        `${sanitizeTerminalText(reminder.id || '')}\t${sanitizeTerminalText(reminder.text || '')}\t${time}\t${status}`
      );
    });
  }
}

class ReminderJsonFormatter extends JsonFormatter<ReminderFormatterOptions> {
  protected transform({ reminders }: ReminderFormatterOptions) {
    return reminders.map((reminder) => ({
      id: reminder.id,
      text: reminder.text,
      time: reminder.time,
      time_formatted: formatTime(reminder.time),
      status: getStatus(reminder.complete_ts),
      recurring: reminder.recurring,
    }));
  }
}

const reminderFormatterFactory = createFormatterFactory<ReminderFormatterOptions>({
  table: new ReminderTableFormatter(),
  simple: new ReminderSimpleFormatter(),
  json: new ReminderJsonFormatter(),
});

export function createReminderFormatter(format: string) {
  return reminderFormatterFactory.create(format);
}
