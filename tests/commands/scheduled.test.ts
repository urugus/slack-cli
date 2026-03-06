import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupScheduledCommand } from '../../src/commands/scheduled';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('scheduled command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;
  let tableSpy: any;

  const mockScheduledMessages = [
    {
      id: 'Q123',
      channel_id: 'C1234567890',
      post_at: 1770855000,
      date_created: 1770854400,
      text: 'Scheduled message 1',
    },
    {
      id: 'Q456',
      channel_id: 'C0987654321',
      post_at: 1770858600,
      date_created: 1770854400,
      text: 'Scheduled message 2',
    },
  ];

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
    tableSpy = vi.spyOn(console, 'table').mockImplementation(() => undefined);

    program = createTestProgram();
    program.addCommand(setupScheduledCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('list subcommand', () => {
    it('should list scheduled messages in table format by default', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
        mockScheduledMessages as any
      );

      await program.parseAsync(['node', 'slack-cli', 'scheduled', 'list']);

      expect(mockSlackClient.listScheduledMessages).toHaveBeenCalledWith(undefined, 50);
      expect(tableSpy).toHaveBeenCalled();
    });

    it('should filter by channel and limit', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
        mockScheduledMessages as any
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'scheduled',
        'list',
        '--channel',
        'general',
        '--limit',
        '10',
      ]);

      expect(mockSlackClient.listScheduledMessages).toHaveBeenCalledWith('general', 10);
    });

    it('should output json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
        mockScheduledMessages as any
      );

      await program.parseAsync(['node', 'slack-cli', 'scheduled', 'list', '--format', 'json']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('"id": "Q123"'));
    });

    it('should sanitize scheduled message content in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue([
        {
          id: 'Q123',
          channel_id: 'C1234567890',
          post_at: 1770855000,
          date_created: 1770854400,
          text: '\u001b]8;;https://example.com\u0007click\u001b]8;;\u0007',
        },
      ] as any);

      await program.parseAsync(['node', 'slack-cli', 'scheduled', 'list', '--format', 'json']);

      const output = JSON.parse(mockConsole.logSpy.mock.calls[0][0]);
      expect(output[0].text).toBe(']8;;https://example.comclick]8;;');
    });

    it('should output simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
        mockScheduledMessages as any
      );

      await program.parseAsync(['node', 'slack-cli', 'scheduled', 'list', '--format', 'simple']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Q123'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Q456'));
    });

    it('should show empty message when no scheduled messages', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue([] as any);

      await program.parseAsync(['node', 'slack-cli', 'scheduled', 'list']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No scheduled messages found');
    });
  });

  describe('cancel subcommand', () => {
    it('should cancel a scheduled message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.cancelScheduledMessage).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'scheduled',
        'cancel',
        '-c',
        'general',
        '--id',
        'Q1298393284',
      ]);

      expect(mockSlackClient.cancelScheduledMessage).toHaveBeenCalledWith('general', 'Q1298393284');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled message Q1298393284 cancelled')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.cancelScheduledMessage).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'scheduled',
        'cancel',
        '-c',
        'general',
        '--id',
        'Q123',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should handle API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.cancelScheduledMessage).mockRejectedValue(
        new Error('invalid_scheduled_message_id')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'scheduled',
        'cancel',
        '-c',
        'general',
        '--id',
        'Q_INVALID',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
