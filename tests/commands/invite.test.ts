import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupInviteCommand } from '../../src/commands/invite';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('invite command', () => {
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
    program.addCommand(setupInviteCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('invite user to channel', () => {
    it('should invite a single user to a channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345',
      ]);

      expect(mockSlackClient.inviteToChannel).toHaveBeenCalledWith('general', ['U12345'], undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invited user(s) to channel #general')
      );
    });

    it('should invite multiple users to a channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345,U67890,U11111',
      ]);

      expect(mockSlackClient.inviteToChannel).toHaveBeenCalledWith('general', [
        'U12345',
        'U67890',
        'U11111',
      ], undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invited user(s) to channel #general')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should pass force option when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345,U67890',
        '--force',
      ]);

      expect(mockSlackClient.inviteToChannel).toHaveBeenCalledWith(
        'general',
        ['U12345', 'U67890'],
        true
      );
    });

    it('should ignore empty user IDs in comma-separated input', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345, ,U67890,,',
      ]);

      expect(mockSlackClient.inviteToChannel).toHaveBeenCalledWith(
        'general',
        ['U12345', 'U67890'],
        undefined
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle channel_not_found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'nonexistent',
        '-u',
        'U12345',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle already_in_channel error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockRejectedValue(
        new Error('already_in_channel')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle cant_invite_self error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.inviteToChannel).mockRejectedValue(
        new Error('cant_invite_self')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        'U12345',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when all user IDs are empty', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'invite',
        '-c',
        'general',
        '-u',
        ' , , ',
      ]);

      expect(mockSlackClient.inviteToChannel).not.toHaveBeenCalled();
      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('At least one valid user ID is required')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
