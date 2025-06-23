import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupUnreadCommand } from '../../src/commands/unread';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';
import { ERROR_MESSAGES } from '../../src/utils/constants';
import chalk from 'chalk';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('unread command', () => {
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
    program.addCommand(setupUnreadCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  const mockChannelsWithUnread = [
    {
      id: 'C123',
      name: 'general',
      is_channel: true,
      is_member: true,
      is_archived: false,
      unread_count: 5,
      unread_count_display: 5,
      last_read: '1705286300.000000',
    },
    {
      id: 'C456',
      name: 'random',
      is_channel: true,
      is_member: true,
      is_archived: false,
      unread_count: 2,
      unread_count_display: 2,
      last_read: '1705286400.000000',
    },
    {
      id: 'C789',
      name: 'dev',
      is_channel: true,
      is_member: true,
      is_archived: false,
      unread_count: 0,
      unread_count_display: 0,
      last_read: '1705286500.000000',
    },
  ];

  const mockUnreadMessages = [
    {
      ts: '1705286400.000001',
      user: 'U123',
      text: 'Hello world',
      type: 'message',
    },
    {
      ts: '1705286500.000002',
      user: 'U456',
      text: 'Test message',
      type: 'message',
    },
  ];

  describe('basic functionality', () => {
    it('should display unread counts in table format by default', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );

      await program.parseAsync(['node', 'slack-cli', 'unread']);

      expect(mockSlackClient.listUnreadChannels).toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Channel'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Unread'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('#general'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('5'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('#random'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
    });

    it('should display only count when --count-only is specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--count-only']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('#general: 5');
      expect(mockConsole.logSpy).toHaveBeenCalledWith('#random: 2');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.bold('Total: 7 unread messages'));
    });

    it('should display in JSON format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--format', 'json']);

      const expectedOutput = [
        { channel: '#general', channelId: 'C123', unreadCount: 5 },
        { channel: '#random', channelId: 'C456', unreadCount: 2 },
      ];
      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(expectedOutput, null, 2));
    });

    it('should display in simple format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--format', 'simple']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('#general (5)');
      expect(mockConsole.logSpy).toHaveBeenCalledWith('#random (2)');
    });
  });

  describe('channel filtering', () => {
    it('should filter by specific channel when --channel is specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.bold(`#general: 5 unread messages`));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Hello world'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should display channel unread in JSON format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general', '--format', 'json']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      
      const logCall = mockConsole.logSpy.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      
      expect(parsed).toEqual({
        channel: '#general',
        channelId: 'C123',
        unreadCount: 5,
        messages: [
          {
            timestamp: expect.any(String),
            author: 'john.doe',
            text: 'Hello world'
          },
          {
            timestamp: expect.any(String),
            author: 'jane.smith',
            text: 'Test message'
          }
        ]
      });
    });

    it('should display channel unread in simple format when specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general', '--format', 'simple']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalledWith('#general (5)');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] john\.doe: Hello world$/));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] jane\.smith: Test message$/));
    });

    it('should show only count for channel when --count-only is specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general', '--count-only']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.bold(`#general: 5 unread messages`));
      expect(mockConsole.logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Hello world'));
      expect(mockConsole.logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should show count only in JSON format when both --count-only and --format json are specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general', '--count-only', '--format', 'json']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      
      const logCall = mockConsole.logSpy.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      
      expect(parsed).toEqual({
        channel: '#general',
        channelId: 'C123',
        unreadCount: 5
      });
    });
  });

  describe('limit option', () => {
    it('should limit the number of channels displayed', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--limit', '1']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('#general'));
      expect(mockConsole.logSpy).not.toHaveBeenCalledWith(expect.stringContaining('#random'));
    });
  });

  describe('error handling', () => {
    it('should display message when no unread messages found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'unread']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.green('✓ No unread messages'));
    });

    it('should handle channel not found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'nonexistent']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'unread']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('profile option', () => {
    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'unread', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limit errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      
      const rateLimitError = new Error('A rate limit was exceeded (url: conversations.info, retry-after: 10)');
      vi.mocked(mockSlackClient.listUnreadChannels).mockRejectedValue(rateLimitError);

      await program.parseAsync(['node', 'slack-cli', 'unread']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.stringContaining('rate limit'));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should not retry indefinitely on rate limit errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      
      const rateLimitError = new Error('A rate limit was exceeded (url: conversations.info, retry-after: 10)');
      vi.mocked(mockSlackClient.listUnreadChannels).mockRejectedValue(rateLimitError);

      await program.parseAsync(['node', 'slack-cli', 'unread']);

      expect(mockSlackClient.listUnreadChannels).toHaveBeenCalledTimes(1);
    });
  });

  describe('last_read timestamp handling', () => {
    it('should fetch messages after last_read timestamp even when unread_count is 0', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      
      const channelWithLastRead = {
        id: 'C08JFKGJPPE',
        name: 'dev_kiban_jira',
        is_channel: true,
        is_member: true,
        is_archived: false,
        unread_count: 0,
        unread_count_display: 0,
        last_read: '1750646034.663209',
        is_private: false,
        created: 1742353688
      };

      const unreadMessage = {
        ts: '1750646072.447069',
        user: 'U5F87BSGP',
        text: '@Suguru Sakashita / 阪下 駿 transitioned ES-4359 ArgumentError: \'発行者\' is not a valid field_name in Clip',
        type: 'message',
      };

      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: { ...channelWithLastRead, unread_count: 1, unread_count_display: 1 },
        messages: [unreadMessage],
        users: new Map([['U5F87BSGP', 'jira-bot']])
      });

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'dev_kiban_jira']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('dev_kiban_jira');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.bold('#dev_kiban_jira: 1 unread messages'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('transitioned ES-4359'));
    });
  });

  describe('mark-read functionality', () => {
    it('should mark messages as read when --mark-read is specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );
      vi.mocked(mockSlackClient.markAsRead).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'unread', '--mark-read']);

      expect(mockSlackClient.listUnreadChannels).toHaveBeenCalled();
      expect(mockSlackClient.markAsRead).toHaveBeenCalledWith('C123');
      expect(mockSlackClient.markAsRead).toHaveBeenCalledWith('C456');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.green('✓ Marked all messages as read'));
    });

    it('should mark messages as read for specific channel when --channel and --mark-read are specified', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getChannelUnread).mockResolvedValue({
        channel: mockChannelsWithUnread[0],
        messages: mockUnreadMessages,
        users: new Map([
          ['U123', 'john.doe'],
          ['U456', 'jane.smith']
        ])
      });
      vi.mocked(mockSlackClient.markAsRead).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'unread', '--channel', 'general', '--mark-read']);

      expect(mockSlackClient.getChannelUnread).toHaveBeenCalledWith('general');
      expect(mockSlackClient.markAsRead).toHaveBeenCalledWith('C123');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(chalk.green('✓ Marked messages in #general as read'));
    });

    it('should handle mark as read errors gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.listUnreadChannels).mockResolvedValue(
        mockChannelsWithUnread.filter(ch => (ch.unread_count_display || 0) > 0)
      );
      vi.mocked(mockSlackClient.markAsRead).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync(['node', 'slack-cli', 'unread', '--mark-read']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});