import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { program } from 'commander';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { slackApiClient } from '../../src/utils/slack-api-client';
import { setupChannelsCommand } from '../../src/commands/channels';
import { ERROR_MESSAGES } from '../../src/utils/constants';

vi.mock('../../src/utils/profile-config');
vi.mock('../../src/utils/slack-api-client');

describe('channels command', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let mockConfigManager: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.clearAllMocks();
    program.removeAllListeners();
    
    // Mock ProfileConfigManager
    mockConfigManager = {
      getConfig: vi.fn(),
      listProfiles: vi.fn()
    };
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('basic functionality', () => {
    it('should list public channels by default', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([
        {
          id: 'C1234567890',
          name: 'general',
          is_channel: true,
          is_private: false,
          num_members: 150,
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
      ]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'public_channel',
          exclude_archived: true,
          limit: 100
        }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('general'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('random'));
    });

    it('should show error when no token is configured', async () => {
      mockConfigManager.getConfig.mockResolvedValue(null);
      mockConfigManager.listProfiles.mockResolvedValue([{ name: 'default', isDefault: true }]);

      const channelsCommand = setupChannelsCommand();
      
      await expect(channelsCommand.parseAsync(['channels'], { from: 'user' }))
        .rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error:', 'No configuration found for profile "default". Use "slack-cli config set --token <token> --profile default" to set up.');
    });
  });

  describe('channel type filtering', () => {
    it('should list private channels when type is private', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([
        {
          id: 'G1234567890',
          name: 'dev-team',
          is_group: true,
          is_private: true,
          num_members: 12,
          created: 1616284800,
          purpose: { value: 'Development team discussions' }
        }
      ]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--type', 'private'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'private_channel',
          exclude_archived: true,
          limit: 100
        }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('dev-team'));
    });

    it('should list all channel types when type is all', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--type', 'all'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'public_channel,private_channel,mpim,im',
          exclude_archived: true,
          limit: 100
        }
      );
    });

    it('should list direct messages when type is im', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--type', 'im'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'im',
          exclude_archived: true,
          limit: 100
        }
      );
    });
  });

  describe('output formatting', () => {
    const mockChannels = [
      {
        id: 'C1234567890',
        name: 'general',
        is_channel: true,
        is_private: false,
        num_members: 150,
        created: 1579075200,
        purpose: { value: 'Company announcements' }
      }
    ];

    it('should output in table format by default', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue(mockChannels);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Name'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Type'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Members'));
    });

    it('should output in simple format when specified', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue(mockChannels);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--format', 'simple'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith('general');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Type'));
    });

    it('should output in JSON format when specified', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue(mockChannels);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--format', 'json'], { from: 'user' });

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('id', 'C1234567890');
      expect(parsed[0]).toHaveProperty('name', 'general');
    });
  });

  describe('additional options', () => {
    it('should include archived channels when flag is set', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--include-archived'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'public_channel',
          exclude_archived: false,
          limit: 100
        }
      );
    });

    it('should respect custom limit', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--limit', '50'], { from: 'user' });

      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'test-token',
        {
          types: 'public_channel',
          exclude_archived: true,
          limit: 50
        }
      );
    });

    it('should use specified profile', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'work-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels', '--profile', 'work'], { from: 'user' });

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(slackApiClient.listChannels).toHaveBeenCalledWith(
        'work-token',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockRejectedValue(new Error('API Error'));

      const channelsCommand = setupChannelsCommand();
      
      await expect(channelsCommand.parseAsync(['channels'], { from: 'user' }))
        .rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error:', 'API Error');
    });

    it('should show message when no channels found', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ token: 'test-token' });
      vi.mocked(slackApiClient.listChannels).mockResolvedValue([]);

      const channelsCommand = setupChannelsCommand();
      await channelsCommand.parseAsync(['channels'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(ERROR_MESSAGES.NO_CHANNELS_FOUND);
    });
  });
});