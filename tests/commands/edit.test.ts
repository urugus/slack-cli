import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupEditCommand } from '../../src/commands/edit';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('edit command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockReturnValue(mockSlackClient);

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupEditCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('edit message', () => {
    it('should update a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.updateMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C1234567890',
        text: 'Updated message',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'edit',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
        '-m',
        'Updated message',
      ]);

      expect(mockSlackClient.updateMessage).toHaveBeenCalledWith(
        'general',
        '1234567890.123456',
        'Updated message'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message updated successfully in #general')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.updateMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C1234567890',
        text: 'Updated',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'edit',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
        '-m',
        'Updated',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('validation', () => {
    it('should fail when timestamp format is invalid', async () => {
      const editCommand = setupEditCommand();
      editCommand.exitOverride();

      await expect(
        editCommand.parseAsync(['-c', 'general', '--ts', 'invalid-ts', '-m', 'Hello'], {
          from: 'user',
        })
      ).rejects.toThrow('Invalid message timestamp format');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'edit',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
        '-m',
        'Hello',
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
      vi.mocked(mockSlackClient.updateMessage).mockRejectedValue(new Error('message_not_found'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'edit',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
        '-m',
        'Hello',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle cant_update_message error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.updateMessage).mockRejectedValue(
        new Error('cant_update_message')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'edit',
        '-c',
        'general',
        '--ts',
        '1234567890.123456',
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
