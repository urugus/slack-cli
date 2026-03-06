import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSendEphemeralCommand } from '../../src/commands/send-ephemeral';
import { ERROR_MESSAGES } from '../../src/utils/constants';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('send-ephemeral command', () => {
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
    program.addCommand(setupSendEphemeralCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('send ephemeral message', () => {
    it('should send an ephemeral message to a user in a channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendEphemeralMessage).mockResolvedValue({
        ok: true,
        message_ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'general',
        '-u',
        'U1234567890',
        '-m',
        'This is ephemeral',
      ]);

      expect(mockSlackClient.sendEphemeralMessage).toHaveBeenCalledWith(
        'general',
        'U1234567890',
        'This is ephemeral',
        undefined
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ephemeral message sent to #general')
      );
    });

    it('should send an ephemeral message with thread_ts', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendEphemeralMessage).mockResolvedValue({
        ok: true,
        message_ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'general',
        '-u',
        'U1234567890',
        '-m',
        'Ephemeral in thread',
        '-t',
        '1719207629.000100',
      ]);

      expect(mockSlackClient.sendEphemeralMessage).toHaveBeenCalledWith(
        'general',
        'U1234567890',
        'Ephemeral in thread',
        '1719207629.000100'
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendEphemeralMessage).mockResolvedValue({
        ok: true,
        message_ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'general',
        '-u',
        'U1234567890',
        '-m',
        'Hello',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('validation', () => {
    it('should fail when no channel is provided', async () => {
      const command = setupSendEphemeralCommand();
      command.exitOverride();

      await expect(
        command.parseAsync(['-u', 'U1234567890', '-m', 'Hello'], { from: 'user' })
      ).rejects.toThrow('--channel is required');
    });

    it('should fail when no user is provided', async () => {
      const command = setupSendEphemeralCommand();
      command.exitOverride();

      await expect(
        command.parseAsync(['-c', 'general', '-m', 'Hello'], { from: 'user' })
      ).rejects.toThrow('--user is required');
    });

    it('should fail when no message is provided', async () => {
      const command = setupSendEphemeralCommand();
      command.exitOverride();

      await expect(
        command.parseAsync(['-c', 'general', '-u', 'U1234567890'], { from: 'user' })
      ).rejects.toThrow('--message is required');
    });

    it('should validate thread timestamp format', async () => {
      const command = setupSendEphemeralCommand();
      command.exitOverride();

      await expect(
        command.parseAsync(
          ['-c', 'general', '-u', 'U1234567890', '-m', 'Hello', '-t', 'invalid-timestamp'],
          { from: 'user' }
        )
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_THREAD_TIMESTAMP);
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'general',
        '-u',
        'U1234567890',
        '-m',
        'Hello',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle Slack API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendEphemeralMessage).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'nonexistent',
        '-u',
        'U1234567890',
        '-m',
        'Hello',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle user_not_in_channel error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendEphemeralMessage).mockRejectedValue(
        new Error('user_not_in_channel')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'send-ephemeral',
        '-c',
        'general',
        '-u',
        'U9999999999',
        '-m',
        'Hello',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
