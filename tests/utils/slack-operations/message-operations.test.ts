import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';
import { MessageHistoryOperations } from '../../../src/utils/slack-operations/message-history-operations';
import { MessageOperations } from '../../../src/utils/slack-operations/message-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      conversations: {
        history: vi.fn(),
        replies: vi.fn(),
      },
      users: {
        info: vi.fn(),
      },
      chat: {
        postMessage: vi.fn(),
        scheduleMessage: vi.fn(),
        scheduledMessages: {
          list: vi.fn(),
        },
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

describe('MessageOperations', () => {
  type MockClient = {
    conversations: {
      history: ReturnType<typeof vi.fn>;
      replies: ReturnType<typeof vi.fn>;
    };
    users: {
      info: ReturnType<typeof vi.fn>;
    };
    chat: {
      postMessage: ReturnType<typeof vi.fn>;
      scheduleMessage: ReturnType<typeof vi.fn>;
      scheduledMessages: {
        list: ReturnType<typeof vi.fn>;
      };
    };
  };

  let messageOps: MessageOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    messageOps = new MessageOperations('test-token');
    mockClient = (messageOps as unknown as { client: MockClient }).client;
  });

  describe('scheduleMessage', () => {
    it('should call chat.scheduleMessage with post_at', async () => {
      mockClient.chat.scheduleMessage.mockResolvedValue({
        ok: true,
        scheduled_message_id: 'Q123',
      });

      await messageOps.scheduleMessage('C1234567890', 'Hello', 1770855000);

      expect(mockClient.chat.scheduleMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'Hello',
        post_at: 1770855000,
      });
    });
  });

  describe('listScheduledMessages', () => {
    it('should call chat.scheduledMessages.list', async () => {
      mockClient.chat.scheduledMessages.list.mockResolvedValue({
        ok: true,
        scheduled_messages: [
          { id: 'Q123', channel_id: 'C123', post_at: 1770855000, date_created: 1770854400 },
        ],
      });

      const result = await messageOps.listScheduledMessages(undefined, 20);

      expect(mockClient.chat.scheduledMessages.list).toHaveBeenCalledWith({ limit: 20 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getHistory with mentions', () => {
    it('should fetch user info for mentioned users in message text', async () => {
      const mockMessages = [
        {
          type: 'message',
          text: 'Hello <@U123456789> can you check this?',
          user: 'U987654321',
          ts: '1234567890.123456',
        },
        {
          type: 'message',
          text: '<@U111111111> and <@U222222222> please review',
          user: 'U333333333',
          ts: '1234567891.123456',
        },
      ];

      const mockUsersInfo = {
        U123456789: { ok: true, user: { name: 'john.doe' } },
        U987654321: { ok: true, user: { name: 'jane.smith' } },
        U111111111: { ok: true, user: { name: 'alice.brown' } },
        U222222222: { ok: true, user: { name: 'bob.wilson' } },
        U333333333: { ok: true, user: { name: 'charlie.davis' } },
      };

      mockClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      mockClient.users.info.mockImplementation(({ user }: { user: string }) => {
        return Promise.resolve(mockUsersInfo[user] || { ok: false });
      });

      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      const result = await messageOps.getHistory('test-channel', { limit: 10 });

      // Verify all user IDs were fetched (both message authors and mentioned users)
      expect(mockClient.users.info).toHaveBeenCalledTimes(5);
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U987654321' });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U333333333' });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U123456789' });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U111111111' });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U222222222' });

      // Verify the returned users map contains all users
      expect(result.users.get('U123456789')).toBe('john.doe');
      expect(result.users.get('U987654321')).toBe('jane.smith');
      expect(result.users.get('U111111111')).toBe('alice.brown');
      expect(result.users.get('U222222222')).toBe('bob.wilson');
      expect(result.users.get('U333333333')).toBe('charlie.davis');
    });

    it('should handle messages with own mentions correctly', async () => {
      const mockMessages = [
        {
          type: 'message',
          text: '<@U07L5D50RAL> please check this task',
          user: 'U123456789',
          ts: '1234567890.123456',
        },
      ];

      const mockUsersInfo = {
        U123456789: { ok: true, user: { name: 'john.doe' } },
        U07L5D50RAL: { ok: true, user: { name: 'koguchi_s' } },
      };

      mockClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: mockMessages,
      });

      mockClient.users.info.mockImplementation(({ user }: { user: string }) => {
        return Promise.resolve(mockUsersInfo[user] || { ok: false });
      });

      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      const result = await messageOps.getHistory('test-channel', { limit: 10 });

      // Verify both users were fetched
      expect(mockClient.users.info).toHaveBeenCalledTimes(2);
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U123456789' });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U07L5D50RAL' });

      // Verify the returned users map contains both users
      expect(result.users.get('U123456789')).toBe('john.doe');
      expect(result.users.get('U07L5D50RAL')).toBe('koguchi_s');
    });
  });

  describe('getThreadHistory', () => {
    it('should fetch complete thread conversation with pagination', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      mockClient.conversations.replies
        .mockResolvedValueOnce({
          ok: true,
          messages: [
            {
              type: 'message',
              text: 'Parent',
              user: 'U111',
              ts: '1234567890.000100',
              thread_ts: '1234567890.000100',
            },
          ],
          response_metadata: {
            next_cursor: 'cursor-1',
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          messages: [
            {
              type: 'message',
              text: 'Reply',
              user: 'U222',
              ts: '1234567891.000200',
              thread_ts: '1234567890.000100',
            },
          ],
          response_metadata: {
            next_cursor: '',
          },
        });

      mockClient.users.info.mockImplementation(({ user }: { user: string }) => {
        if (user === 'U111') return Promise.resolve({ ok: true, user: { name: 'alice' } });
        if (user === 'U222') return Promise.resolve({ ok: true, user: { name: 'bob' } });
        return Promise.resolve({ ok: false });
      });

      const result = await messageOps.getThreadHistory('general', '1234567890.000100');

      expect(mockClient.conversations.replies).toHaveBeenCalledTimes(2);
      expect(mockClient.conversations.replies).toHaveBeenNthCalledWith(1, {
        channel: 'C123456789',
        ts: '1234567890.000100',
        cursor: undefined,
      });
      expect(mockClient.conversations.replies).toHaveBeenNthCalledWith(2, {
        channel: 'C123456789',
        ts: '1234567890.000100',
        cursor: 'cursor-1',
      });
      expect(result.messages).toHaveLength(2);
      expect(result.users.get('U111')).toBe('alice');
      expect(result.users.get('U222')).toBe('bob');
    });
  });

  describe('getChannelUnread', () => {
    it('should retry history fetches when Slack rate limits a page request', async () => {
      const delaySpy = vi
        .spyOn(MessageHistoryOperations.prototype, 'handleRateLimit')
        .mockResolvedValue(undefined);
      vi.spyOn(ChannelOperations.prototype, 'getChannelInfo').mockResolvedValue({
        id: 'C123456789',
        name: 'general',
        is_private: false,
        created: 1234567890,
        last_read: '1234567889.000000',
      });

      mockClient.conversations.history
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce({
          ok: true,
          messages: [
            {
              type: 'message',
              text: 'Unread message',
              user: 'U111',
              ts: '1234567890.000100',
            },
          ],
          response_metadata: {
            next_cursor: '',
          },
        });

      mockClient.users.info.mockResolvedValue({
        ok: true,
        user: { name: 'alice' },
      });

      const result = await messageOps.getChannelUnread('general');

      expect(delaySpy).toHaveBeenCalledTimes(1);
      expect(mockClient.conversations.history).toHaveBeenCalledTimes(2);
      expect(result.totalUnreadCount).toBe(1);
      expect(result.displayedMessageCount).toBe(1);
    });
  });
});
