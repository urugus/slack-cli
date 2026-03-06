import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupReminderCommand } from '../../src/commands/reminder';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('reminder command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    } as any);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    } as any);

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupReminderCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('add subcommand', () => {
    it('should add a reminder with --at option', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const mockReminder = {
        id: 'Rm01ABCDEF',
        text: 'PRレビューする',
        time: 1709290800,
        complete_ts: 0,
        recurring: false,
      };
      vi.mocked(mockSlackClient.addReminder).mockResolvedValue(mockReminder);

      await program.parseAsync([
        'node',
        'slack-cli',
        'reminder',
        'add',
        '--text',
        'PRレビューする',
        '--at',
        '2024-03-01 15:00',
      ]);

      expect(mockSlackClient.addReminder).toHaveBeenCalledWith(
        'PRレビューする',
        expect.any(Number)
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Reminder created'));
    });

    it('should add a reminder with --after option (minutes)', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const mockReminder = {
        id: 'Rm01ABCDEF',
        text: 'デプロイ確認',
        time: Math.floor(Date.now() / 1000) + 30 * 60,
        complete_ts: 0,
        recurring: false,
      };
      vi.mocked(mockSlackClient.addReminder).mockResolvedValue(mockReminder);

      await program.parseAsync([
        'node',
        'slack-cli',
        'reminder',
        'add',
        '--text',
        'デプロイ確認',
        '--after',
        '30',
      ]);

      expect(mockSlackClient.addReminder).toHaveBeenCalledWith('デプロイ確認', expect.any(Number));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Reminder created'));
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      const mockReminder = {
        id: 'Rm01ABCDEF',
        text: 'test',
        time: 1709290800,
        complete_ts: 0,
        recurring: false,
      };
      vi.mocked(mockSlackClient.addReminder).mockResolvedValue(mockReminder);

      await program.parseAsync([
        'node',
        'slack-cli',
        'reminder',
        'add',
        '--text',
        'test',
        '--at',
        '2024-03-01 15:00',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should fail when neither --at nor --after is specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'add', '--text', 'test']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when both --at and --after are specified', async () => {
      const reminderCommand = setupReminderCommand();
      reminderCommand.exitOverride();

      const addCommand = reminderCommand.commands.find((c: any) => c.name() === 'add')!;
      addCommand.exitOverride();

      await expect(
        addCommand.parseAsync(['--text', 'test', '--at', '2024-03-01 15:00', '--after', '30'], {
          from: 'user',
        })
      ).rejects.toThrow();
    });
  });

  describe('list subcommand', () => {
    it('should list reminders in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listReminders).mockResolvedValue([
        {
          id: 'Rm01ABCDEF',
          text: 'PRレビューする',
          time: 1709290800,
          complete_ts: 0,
          recurring: false,
        },
      ]);

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'list']);

      expect(mockSlackClient.listReminders).toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should list reminders in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const reminders = [
        {
          id: 'Rm01ABCDEF',
          text: 'PRレビューする',
          time: 1709290800,
          complete_ts: 0,
          recurring: false,
        },
      ];
      vi.mocked(mockSlackClient.listReminders).mockResolvedValue(reminders);

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'list', '--format', 'json']);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = JSON.parse(mockConsole.logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(1);
      expect(output[0].id).toBe('Rm01ABCDEF');
    });

    it('should list reminders in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listReminders).mockResolvedValue([
        {
          id: 'Rm01ABCDEF',
          text: 'PRレビューする',
          time: 1709290800,
          complete_ts: 0,
          recurring: false,
        },
      ]);

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'list', '--format', 'simple']);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = mockConsole.logSpy.mock.calls[0][0];
      expect(output).toContain('Rm01ABCDEF');
      expect(output).toContain('PRレビューする');
    });

    it('should show message when no reminders found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listReminders).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'list']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No reminders found');
    });
  });

  describe('delete subcommand', () => {
    it('should delete a reminder by ID', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteReminder).mockResolvedValue();

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'delete', '--id', 'Rm01ABCDEF']);

      expect(mockSlackClient.deleteReminder).toHaveBeenCalledWith('Rm01ABCDEF');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Reminder deleted'));
    });
  });

  describe('complete subcommand', () => {
    it('should complete a reminder by ID', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.completeReminder).mockResolvedValue();

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'complete', '--id', 'Rm01ABCDEF']);

      expect(mockSlackClient.completeReminder).toHaveBeenCalledWith('Rm01ABCDEF');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reminder completed')
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'list']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle API error on add', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addReminder).mockRejectedValue(new Error('invalid_time'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'reminder',
        'add',
        '--text',
        'test',
        '--at',
        '2024-03-01 15:00',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle API error on delete', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteReminder).mockRejectedValue(new Error('not_found'));

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'delete', '--id', 'Rm01ABCDEF']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle API error on complete', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.completeReminder).mockRejectedValue(new Error('not_found'));

      await program.parseAsync(['node', 'slack-cli', 'reminder', 'complete', '--id', 'Rm01ABCDEF']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
