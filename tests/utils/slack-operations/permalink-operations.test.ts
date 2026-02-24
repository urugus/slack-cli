import { beforeEach, describe, it, expect, vi } from 'vitest';
import { MessageOperations } from '../../../src/utils/slack-operations/message-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      getPermalink: vi.fn(),
      postMessage: vi.fn(),
      scheduleMessage: vi.fn(),
      scheduledMessages: { list: vi.fn() },
      update: vi.fn(),
      delete: vi.fn(),
      deleteScheduledMessage: vi.fn(),
    },
    conversations: {
      list: vi.fn(),
      history: vi.fn(),
      replies: vi.fn(),
      mark: vi.fn(),
      info: vi.fn(),
    },
    users: {
      info: vi.fn(),
    },
  })),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

import { channelResolver } from '../../../src/utils/channel-resolver';

describe('MessageOperations - getPermalink', () => {
  let messageOps: MessageOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    messageOps = new MessageOperations('test-token');
    mockClient = (messageOps as any).client;
  });

  describe('getPermalink', () => {
    it('should return a permalink for a message', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.chat.getPermalink.mockResolvedValue({
        ok: true,
        permalink: 'https://team.slack.com/archives/C123456/p1234567890123456',
      });

      const result = await messageOps.getPermalink('general', '1234567890.123456');

      expect(mockClient.chat.getPermalink).toHaveBeenCalledWith({
        channel: 'C123456',
        message_ts: '1234567890.123456',
      });
      expect(result).toBe('https://team.slack.com/archives/C123456/p1234567890123456');
    });

    it('should return null when permalink retrieval fails', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.chat.getPermalink.mockRejectedValue(new Error('message_not_found'));

      const result = await messageOps.getPermalink('general', '1234567890.123456');

      expect(result).toBeNull();
    });
  });

  describe('getPermalinks', () => {
    it('should return permalinks for multiple messages', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.chat.getPermalink
        .mockResolvedValueOnce({
          ok: true,
          permalink: 'https://team.slack.com/archives/C123456/p1111',
        })
        .mockResolvedValueOnce({
          ok: true,
          permalink: 'https://team.slack.com/archives/C123456/p2222',
        });

      const result = await messageOps.getPermalinks('general', [
        '1111111111.111111',
        '2222222222.222222',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('1111111111.111111')).toBe(
        'https://team.slack.com/archives/C123456/p1111'
      );
      expect(result.get('2222222222.222222')).toBe(
        'https://team.slack.com/archives/C123456/p2222'
      );
    });

    it('should skip failed permalink retrievals gracefully', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.chat.getPermalink
        .mockResolvedValueOnce({
          ok: true,
          permalink: 'https://team.slack.com/archives/C123456/p1111',
        })
        .mockRejectedValueOnce(new Error('message_not_found'));

      const result = await messageOps.getPermalinks('general', [
        '1111111111.111111',
        '2222222222.222222',
      ]);

      expect(result.size).toBe(1);
      expect(result.get('1111111111.111111')).toBe(
        'https://team.slack.com/archives/C123456/p1111'
      );
      expect(result.has('2222222222.222222')).toBe(false);
    });

    it('should return empty map for empty timestamps array', async () => {
      const result = await messageOps.getPermalinks('general', []);

      expect(result.size).toBe(0);
    });
  });
});
