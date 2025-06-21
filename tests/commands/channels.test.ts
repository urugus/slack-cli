import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupChannelsCommand } from '../../src/commands/channels';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';
import { ERROR_MESSAGES } from '../../src/utils/constants';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('channels command', () => {
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
    program.addCommand(setupChannelsCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  const mockChannels = [
    {
      id: 'C1234567890',
      name: 'general',
      is_channel: true,
      is_private: false,
      num_members: 250,
      created: 1579075200,
      purpose: { value: 'Company announcements' }
    },
    {
      id: 'C0987654321',
      name: 'random',
      is_channel: true,
      is_private: false,
      num_members: 145,
      created: 1579075200,
      purpose: { value: 'Random discussions' }
    }
  ];

  describe('basic functionality', () => {
    it('should list public channels by default', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('random'));
    });

    it('should show error when no token is configured', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);
      vi.mocked(mockConfigManager.listProfiles).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'channels']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith('✗ Error:', ERROR_MESSAGES.NO_CONFIG('default'));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('channel type filtering', () => {
    it('should list private channels when type is private', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--type', 'private']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'private_channel',
        exclude_archived: true,
        limit: 100
      });
    });

    it('should list all channel types when type is all', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--type', 'all']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: true,
        limit: 100
      });
    });

    it('should list direct messages when type is im', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--type', 'im']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'im',
        exclude_archived: true,
        limit: 100
      });
    });
  });

  describe('output formatting', () => {
    it('should output in table format by default', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Name'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Type'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Members'));
    });

    it('should output in simple format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--format', 'simple']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalledWith('random');
    });

    it('should output in JSON format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--format', 'json']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('"name": "general"'));
    });
  });

  describe('additional options', () => {
    it('should include archived channels when flag is set', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--include-archived']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'public_channel',
        exclude_archived: false,
        limit: 100
      });
    });

    it('should respect custom limit', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--limit', '50']);

      expect(mockSlackClient.listChannels).toHaveBeenCalledWith({
        types: 'public_channel',
        exclude_archived: true,
        limit: 50
      });
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue(mockChannels);

      await program.parseAsync(['node', 'slack-cli', 'channels', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockRejectedValue(new Error('API Error'));

      await program.parseAsync(['node', 'slack-cli', 'channels']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith('✗ Error:', 'API Error');
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show message when no channels found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listChannels).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'channels']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(ERROR_MESSAGES.NO_CHANNELS_FOUND);
    });
  });
});