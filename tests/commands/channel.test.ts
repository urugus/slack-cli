import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupChannelCommand } from '../../src/commands/channel';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('channel command', () => {
  let program: ReturnType<decltype_createTestProgram>;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: ReturnType<decltype_setupMockConsole>;

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
    program.addCommand(setupChannelCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('info subcommand', () => {
    it('should display channel info in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.getChannelDetail).mockResolvedValue({
        id: 'C1234567890',
        name: 'general',
        is_private: false,
        is_archived: false,
        created: 1579075200,
        num_members: 42,
        topic: { value: 'Current topic', creator: 'U111', last_set: 1700000000 },
        purpose: { value: 'Current purpose', creator: 'U222', last_set: 1700000001 },
      });

      await program.parseAsync(['node', 'slack-cli', 'channel', 'info', '-c', 'general']);

      expect(mockSlackClient.getChannelDetail).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Current topic'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Current purpose'));
    });

    it('should display channel info in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.getChannelDetail).mockResolvedValue({
        id: 'C1234567890',
        name: 'general',
        is_private: false,
        created: 1579075200,
        num_members: 10,
        topic: { value: 'Topic here' },
        purpose: { value: 'Purpose here' },
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'info',
        '-c',
        'general',
        '--format',
        'json',
      ]);

      const logCall = mockConsole.logSpy.mock.calls.find((call: unknown[]) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });

      expect(logCall).toBeDefined();
      const output = JSON.parse(logCall![0]);
      expect(output.name).toBe('general');
      expect(output.topic).toBe('Topic here');
      expect(output.purpose).toBe('Purpose here');
    });

    it('should display channel info in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.getChannelDetail).mockResolvedValue({
        id: 'C1234567890',
        name: 'general',
        is_private: false,
        created: 1579075200,
        num_members: 10,
        topic: { value: 'Topic here' },
        purpose: { value: 'Purpose here' },
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'info',
        '-c',
        'general',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Topic here'));
    });

    it('should handle missing topic and purpose', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.getChannelDetail).mockResolvedValue({
        id: 'C1234567890',
        name: 'empty-channel',
        is_private: false,
        created: 1579075200,
      });

      await program.parseAsync(['node', 'slack-cli', 'channel', 'info', '-c', 'empty-channel']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('empty-channel'));
    });
  });

  describe('set-topic subcommand', () => {
    it('should set channel topic successfully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.setTopic).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'set-topic',
        '-c',
        'general',
        '--topic',
        'New topic',
      ]);

      expect(mockSlackClient.setTopic).toHaveBeenCalledWith('general', 'New topic');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.setTopic).mockRejectedValue(new Error('not_in_channel'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'set-topic',
        '-c',
        'general',
        '--topic',
        'New topic',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith('✗ Error:', 'not_in_channel');
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.setTopic).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'set-topic',
        '-c',
        'general',
        '--topic',
        'Test',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
    });
  });

  describe('set-purpose subcommand', () => {
    it('should set channel purpose successfully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.setPurpose).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'set-purpose',
        '-c',
        'general',
        '--purpose',
        'New purpose',
      ]);

      expect(mockSlackClient.setPurpose).toHaveBeenCalledWith('general', 'New purpose');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.setPurpose).mockRejectedValue(new Error('channel_not_found'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'channel',
        'set-purpose',
        '-c',
        'unknown',
        '--purpose',
        'New purpose',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith('✗ Error:', 'channel_not_found');
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
