import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMembersCommand } from '../../src/commands/members';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('members command', () => {
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
    program.addCommand(setupMembersCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('basic functionality', () => {
    it('should list channel members in table format by default', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: ['U01ABCDEF', 'U02GHIJKL'],
        nextCursor: '',
      });
      vi.mocked(mockSlackClient.getUserInfo).mockImplementation(async (userId: string) => {
        const users: Record<string, any> = {
          U01ABCDEF: { id: 'U01ABCDEF', name: 'alice', real_name: 'Alice Smith' },
          U02GHIJKL: { id: 'U02GHIJKL', name: 'bob', real_name: 'Bob Jones' },
        };
        return users[userId];
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
      ]);

      expect(mockSlackClient.getChannelMembers).toHaveBeenCalledWith('C1234567890', {
        limit: 100,
      });
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should list channel members in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: ['U01ABCDEF'],
        nextCursor: '',
      });
      vi.mocked(mockSlackClient.getUserInfo).mockResolvedValue({
        id: 'U01ABCDEF',
        name: 'alice',
        real_name: 'Alice Smith',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id": "U01ABCDEF"')
      );
    });

    it('should list channel members in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: ['U01ABCDEF'],
        nextCursor: '',
      });
      vi.mocked(mockSlackClient.getUserInfo).mockResolvedValue({
        id: 'U01ABCDEF',
        name: 'alice',
        real_name: 'Alice Smith',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('U01ABCDEF')
      );
    });

    it('should show message when no members found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: [],
        nextCursor: '',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No members found');
    });
  });

  describe('options', () => {
    it('should respect limit option', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: ['U01ABCDEF'],
        nextCursor: '',
      });
      vi.mocked(mockSlackClient.getUserInfo).mockResolvedValue({
        id: 'U01ABCDEF',
        name: 'alice',
        real_name: 'Alice Smith',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
        '--limit',
        '50',
      ]);

      expect(mockSlackClient.getChannelMembers).toHaveBeenCalledWith('C1234567890', {
        limit: 50,
      });
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: [],
        nextCursor: '',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'CINVALID',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should gracefully handle user info resolution failures', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getChannelMembers).mockResolvedValue({
        members: ['U01ABCDEF', 'U02GHIJKL'],
        nextCursor: '',
      });
      vi.mocked(mockSlackClient.getUserInfo)
        .mockResolvedValueOnce({
          id: 'U01ABCDEF',
          name: 'alice',
          real_name: 'Alice Smith',
        })
        .mockRejectedValueOnce(new Error('user_not_found'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'members',
        '-c',
        'C1234567890',
      ]);

      // Should still succeed - failed user lookups show ID only
      expect(mockConsole.logSpy).toHaveBeenCalled();
      expect(mockConsole.exitSpy).not.toHaveBeenCalled();
    });
  });
});
