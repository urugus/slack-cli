import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReminderOperations } from '../../../src/utils/slack-operations/reminder-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      reminders: {
        add: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        complete: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

describe('ReminderOperations', () => {
  let reminderOps: ReminderOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    reminderOps = new ReminderOperations('test-token');
    mockClient = (reminderOps as any).client;
  });

  describe('addReminder', () => {
    it('should add a reminder with text and time', async () => {
      const mockReminder = {
        id: 'Rm01ABCDEF',
        text: 'PRレビューする',
        time: 1709290800,
        complete_ts: 0,
        recurring: false,
      };
      mockClient.reminders.add.mockResolvedValue({
        ok: true,
        reminder: mockReminder,
      });

      const result = await reminderOps.addReminder('PRレビューする', 1709290800);

      expect(mockClient.reminders.add).toHaveBeenCalledWith({
        text: 'PRレビューする',
        time: 1709290800,
      });
      expect(result).toEqual(mockReminder);
    });

    it('should throw when reminder add fails', async () => {
      mockClient.reminders.add.mockRejectedValue(new Error('invalid_time'));

      await expect(reminderOps.addReminder('test', 0)).rejects.toThrow('invalid_time');
    });
  });

  describe('listReminders', () => {
    it('should list all reminders', async () => {
      const mockReminders = [
        {
          id: 'Rm01ABCDEF',
          text: 'PRレビューする',
          time: 1709290800,
          complete_ts: 0,
          recurring: false,
        },
        {
          id: 'Rm02GHIJKL',
          text: 'デプロイ確認',
          time: 1709294400,
          complete_ts: 0,
          recurring: false,
        },
      ];
      mockClient.reminders.list.mockResolvedValue({
        ok: true,
        reminders: mockReminders,
      });

      const result = await reminderOps.listReminders();

      expect(mockClient.reminders.list).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockReminders[0]);
    });

    it('should return empty array when no reminders exist', async () => {
      mockClient.reminders.list.mockResolvedValue({
        ok: true,
        reminders: [],
      });

      const result = await reminderOps.listReminders();

      expect(result).toEqual([]);
    });

    it('should return empty array when reminders is undefined', async () => {
      mockClient.reminders.list.mockResolvedValue({
        ok: true,
      });

      const result = await reminderOps.listReminders();

      expect(result).toEqual([]);
    });
  });

  describe('deleteReminder', () => {
    it('should delete a reminder by ID', async () => {
      mockClient.reminders.delete.mockResolvedValue({ ok: true });

      await reminderOps.deleteReminder('Rm01ABCDEF');

      expect(mockClient.reminders.delete).toHaveBeenCalledWith({
        reminder: 'Rm01ABCDEF',
      });
    });

    it('should throw when delete fails', async () => {
      mockClient.reminders.delete.mockRejectedValue(new Error('not_found'));

      await expect(reminderOps.deleteReminder('Rm01ABCDEF')).rejects.toThrow('not_found');
    });
  });

  describe('completeReminder', () => {
    it('should complete a reminder by ID', async () => {
      mockClient.reminders.complete.mockResolvedValue({ ok: true });

      await reminderOps.completeReminder('Rm01ABCDEF');

      expect(mockClient.reminders.complete).toHaveBeenCalledWith({
        reminder: 'Rm01ABCDEF',
      });
    });

    it('should throw when complete fails', async () => {
      mockClient.reminders.complete.mockRejectedValue(new Error('not_found'));

      await expect(reminderOps.completeReminder('Rm01ABCDEF')).rejects.toThrow('not_found');
    });
  });
});
