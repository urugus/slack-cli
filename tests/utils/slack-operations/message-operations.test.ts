import { beforeEach, describe, it, expect, vi } from 'vitest';
import { MessageOperations } from '../../../src/utils/slack-operations/message-operations';
import { channelResolver } from '../../../src/utils/channel-resolver';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: {
      history: vi.fn(),
    },
    users: {
      info: vi.fn(),
    },
    chat: {
      postMessage: vi.fn(),
    },
  })),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

describe('MessageOperations', () => {
  let messageOps: MessageOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    messageOps = new MessageOperations('test-token');
    mockClient = (messageOps as any).client;
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
});