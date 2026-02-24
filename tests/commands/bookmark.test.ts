import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupBookmarkCommand } from '../../src/commands/bookmark';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('bookmark command', () => {
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
    program.addCommand(setupBookmarkCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('add subcommand', () => {
    it('should add a bookmark with channel and timestamp', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addStar).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'add',
        '-c',
        'C1234567890',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.addStar).toHaveBeenCalledWith(
        'C1234567890',
        '1234567890.123456'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Saved')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addStar).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'add',
        '-c',
        'C1234567890',
        '--ts',
        '1234567890.123456',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should handle API error on add', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addStar).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'add',
        '-c',
        'C1234567890',
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

  describe('list subcommand', () => {
    it('should list bookmarks in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listStars).mockResolvedValue({
        items: [
          {
            type: 'message',
            channel: 'C1234567890',
            message: {
              text: 'Hello, world!',
              ts: '1234567890.123456',
            },
            date_create: 1709290800,
          },
        ],
      });

      await program.parseAsync(['node', 'slack-cli', 'bookmark', 'list']);

      expect(mockSlackClient.listStars).toHaveBeenCalledWith(100);
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should list bookmarks in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listStars).mockResolvedValue({
        items: [
          {
            type: 'message',
            channel: 'C1234567890',
            message: {
              text: 'Hello, world!',
              ts: '1234567890.123456',
            },
            date_create: 1709290800,
          },
        ],
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'list',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = JSON.parse(mockConsole.logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(1);
      expect(output[0].channel).toBe('C1234567890');
    });

    it('should list bookmarks in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listStars).mockResolvedValue({
        items: [
          {
            type: 'message',
            channel: 'C1234567890',
            message: {
              text: 'Hello, world!',
              ts: '1234567890.123456',
            },
            date_create: 1709290800,
          },
        ],
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'list',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = mockConsole.logSpy.mock.calls[0][0];
      expect(output).toContain('C1234567890');
      expect(output).toContain('Hello, world!');
    });

    it('should pass custom limit', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listStars).mockResolvedValue({
        items: [],
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'list',
        '--limit',
        '50',
      ]);

      expect(mockSlackClient.listStars).toHaveBeenCalledWith(50);
    });

    it('should show message when no bookmarks found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listStars).mockResolvedValue({
        items: [],
      });

      await program.parseAsync(['node', 'slack-cli', 'bookmark', 'list']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No saved items found');
    });
  });

  describe('remove subcommand', () => {
    it('should remove a bookmark with channel and timestamp', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.removeStar).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'remove',
        '-c',
        'C1234567890',
        '--ts',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.removeStar).toHaveBeenCalledWith(
        'C1234567890',
        '1234567890.123456'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed')
      );
    });

    it('should handle API error on remove', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.removeStar).mockRejectedValue(
        new Error('not_starred')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'remove',
        '-c',
        'C1234567890',
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

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'bookmark',
        'list',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
