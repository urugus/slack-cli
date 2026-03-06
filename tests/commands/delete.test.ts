import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupDeleteCommand } from '../../src/commands/delete';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('delete command', () => {
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
    program.addCommand(setupDeleteCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('delete message', () => {
    it('should delete a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteMessage).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'delete',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.deleteMessage).toHaveBeenCalledWith('general', '1234567890.123456');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message deleted successfully from #general')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteMessage).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'delete',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('validation', () => {
    it('should fail when timestamp format is invalid', async () => {
      const deleteCommand = setupDeleteCommand();
      deleteCommand.exitOverride();

      await expect(
        deleteCommand.parseAsync(['-c', 'general', '--ts', 'invalid-ts'], { from: 'user' })
      ).rejects.toThrow('Invalid message timestamp format');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'delete',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle message_not_found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteMessage).mockRejectedValue(new Error('message_not_found'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'delete',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle cant_delete_message error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.deleteMessage).mockRejectedValue(new Error('cant_delete_message'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'delete',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
