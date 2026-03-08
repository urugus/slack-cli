import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupReactionCommand } from '../../src/commands/reaction';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('reaction command', () => {
  let program: ReturnType<typeof createTestProgram>;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: ReturnType<typeof setupMockConsole>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    });

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    });

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupReactionCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('add subcommand', () => {
    it('should add a reaction to a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addReaction).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'reaction',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '-e',
        'thumbsup',
      ]);

      expect(mockSlackClient.addReaction).toHaveBeenCalledWith(
        'general',
        '1234567890.123456',
        'thumbsup'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reaction :thumbsup: added')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addReaction).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'reaction',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '-e',
        'thumbsup',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('remove subcommand', () => {
    it('should remove a reaction from a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.removeReaction).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'reaction',
        'remove',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '-e',
        'thumbsup',
      ]);

      expect(mockSlackClient.removeReaction).toHaveBeenCalledWith(
        'general',
        '1234567890.123456',
        'thumbsup'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reaction :thumbsup: removed')
      );
    });
  });

  describe('validation', () => {
    it('should fail when timestamp format is invalid', async () => {
      const reactionCommand = setupReactionCommand();
      reactionCommand.exitOverride();

      const addCommand = reactionCommand.commands.find((c) => c.name() === 'add')!;
      addCommand.exitOverride();

      await expect(
        addCommand.parseAsync(['-c', 'general', '-t', 'invalid-ts', '-e', 'thumbsup'], {
          from: 'user',
        })
      ).rejects.toThrow('Invalid thread timestamp format');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'reaction',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '-e',
        'thumbsup',
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
      vi.mocked(mockSlackClient.addReaction).mockRejectedValue(new Error('already_reacted'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'reaction',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '-e',
        'thumbsup',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
