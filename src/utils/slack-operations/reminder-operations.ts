import { BaseSlackClient } from './base-client';

export interface Reminder {
  id: string;
  text: string;
  time: number;
  complete_ts: number;
  recurring: boolean;
}

export class ReminderOperations extends BaseSlackClient {
  async addReminder(text: string, time: number): Promise<Reminder> {
    const response = await this.client.reminders.add({
      text,
      time,
    });
    return response.reminder as unknown as Reminder;
  }

  async listReminders(): Promise<Reminder[]> {
    const response = await this.client.reminders.list();
    return (response as { reminders?: Reminder[] }).reminders || [];
  }

  async deleteReminder(reminderId: string): Promise<void> {
    await this.client.reminders.delete({
      reminder: reminderId,
    });
  }

  async completeReminder(reminderId: string): Promise<void> {
    await this.client.reminders.complete({
      reminder: reminderId,
    });
  }
}
