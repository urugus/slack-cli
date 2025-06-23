import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: {
      list: vi.fn(),
      info: vi.fn(),
      history: vi.fn(),
    },
  })),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('p-limit', () => ({
  default: () => (fn: any) => fn(),
}));

describe('ChannelOperations', () => {
  let channelOps: ChannelOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
      },
    };
    // Create instance with mocked token
    channelOps = new ChannelOperations('test-token');
    // Replace the client with our mock
    (channelOps as any).client = mockClient;
  });

  describe('listUnreadChannels', () => {
    it('should detect unread messages when last_read is present', async () => {
      // Mock conversations.list response
      mockClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general' },
          { id: 'C456', name: 'random' },
        ],
      });

      // Mock conversations.info responses
      mockClient.conversations.info
        .mockResolvedValueOnce({
          channel: {
            id: 'C123',
            name: 'general',
            last_read: '1234567890.000100',
          },
        })
        .mockResolvedValueOnce({
          channel: {
            id: 'C456',
            name: 'random',
            last_read: '1234567890.000200',
          },
        });

      // Mock conversations.history responses
      mockClient.conversations.history
        // First call for C123 - check latest message
        .mockResolvedValueOnce({
          messages: [{ ts: '1234567890.000200' }], // Newer than last_read
        })
        // Second call for C123 - get unread messages
        .mockResolvedValueOnce({
          messages: [
            { ts: '1234567890.000200' },
            { ts: '1234567890.000150' },
          ],
        })
        // Third call for C456 - check latest message
        .mockResolvedValueOnce({
          messages: [{ ts: '1234567890.000100' }], // Older than last_read
        });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C123',
        name: 'general',
        unread_count: 2,
        unread_count_display: 2,
        last_read: '1234567890.000100',
      });
    });

    it('should count all messages as unread when last_read is not present', async () => {
      // Mock conversations.list response
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C789', name: 'no-read-channel' }],
      });

      // Mock conversations.info response - no last_read
      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C789',
          name: 'no-read-channel',
          // last_read is missing
        },
      });

      // Mock conversations.history responses
      mockClient.conversations.history
        // First call - check if channel has messages
        .mockResolvedValueOnce({
          messages: [{ ts: '1234567890.000300' }],
        })
        // Second call - get all messages (up to 100)
        .mockResolvedValueOnce({
          messages: [
            { ts: '1234567890.000300' },
            { ts: '1234567890.000200' },
            { ts: '1234567890.000100' },
          ],
        });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C789',
        name: 'no-read-channel',
        unread_count: 3,
        unread_count_display: 3,
        last_read: undefined,
      });
    });

    it('should skip channels with no messages', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C999', name: 'empty-channel' }],
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C999',
          name: 'empty-channel',
          last_read: '1234567890.000100',
        },
      });

      // No messages in channel
      mockClient.conversations.history.mockResolvedValue({
        messages: [],
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
    });

    it('should skip channels with all messages read', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C111', name: 'all-read' }],
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C111',
          name: 'all-read',
          last_read: '1234567890.000200',
        },
      });

      // Latest message is older than last_read
      mockClient.conversations.history.mockResolvedValue({
        messages: [{ ts: '1234567890.000100' }],
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C222', name: 'error-channel' },
          { id: 'C333', name: 'good-channel' },
        ],
      });

      // First channel throws error
      mockClient.conversations.info
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          channel: {
            id: 'C333',
            name: 'good-channel',
            last_read: '1234567890.000100',
          },
        });

      mockClient.conversations.history
        .mockResolvedValueOnce({
          messages: [{ ts: '1234567890.000200' }],
        })
        .mockResolvedValueOnce({
          messages: [{ ts: '1234567890.000200' }],
        });

      const result = await channelOps.listUnreadChannels();

      // Should skip the error channel and process the good one
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('C333');
    });

    it('should handle rate limiting with delay', async () => {
      const delaySpy = vi.spyOn(channelOps as any, 'delay');
      
      mockClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C444', name: 'channel1' },
          { id: 'C555', name: 'channel2' },
        ],
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: { id: 'C444', name: 'channel1' },
      });

      mockClient.conversations.history.mockResolvedValue({
        messages: [],
      });

      await channelOps.listUnreadChannels();

      // Verify delay was called between API calls
      expect(delaySpy).toHaveBeenCalledWith(100);
    });
  });
});