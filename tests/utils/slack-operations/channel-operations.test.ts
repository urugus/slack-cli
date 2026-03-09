import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
      },
      users: {
        conversations: vi.fn(),
        info: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('p-limit', () => ({
  default: () => (fn: () => unknown) => fn(),
}));

describe('ChannelOperations', () => {
  type MockClient = {
    conversations: {
      list: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      history: ReturnType<typeof vi.fn>;
    };
    users: {
      conversations: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
    };
  };

  let channelOps: ChannelOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
      },
      users: {
        conversations: vi.fn(),
        info: vi.fn(),
      },
    };
    // Create instance with mocked token
    channelOps = new ChannelOperations('test-token');
    // Replace the client with our mock
    (channelOps as unknown as { client: MockClient }).client = mockClient;
  });

  describe('fetchUserChannels', () => {
    it('should use users.conversations API to fetch user channels', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general' },
          { id: 'C456', name: 'random' },
        ],
        response_metadata: { next_cursor: '' },
      });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'C123', name: 'general' });
      expect(result[1]).toMatchObject({ id: 'C456', name: 'random' });
      expect(mockClient.users.conversations).toHaveBeenCalledWith({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 200,
        cursor: undefined,
      });
    });

    it('should handle pagination with next_cursor', async () => {
      mockClient.users.conversations
        .mockResolvedValueOnce({
          channels: [
            { id: 'C001', name: 'channel-1' },
            { id: 'C002', name: 'channel-2' },
          ],
          response_metadata: { next_cursor: 'cursor_page2' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C003', name: 'channel-3' }],
          response_metadata: { next_cursor: '' },
        });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('C001');
      expect(result[1].id).toBe('C002');
      expect(result[2].id).toBe('C003');
      expect(mockClient.users.conversations).toHaveBeenCalledTimes(2);
      expect(mockClient.users.conversations).toHaveBeenNthCalledWith(2, {
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 200,
        cursor: 'cursor_page2',
      });
    });

    it('should handle multiple pages of pagination', async () => {
      mockClient.users.conversations
        .mockResolvedValueOnce({
          channels: [{ id: 'C001', name: 'ch1' }],
          response_metadata: { next_cursor: 'cursor2' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C002', name: 'ch2' }],
          response_metadata: { next_cursor: 'cursor3' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C003', name: 'ch3' }],
          response_metadata: { next_cursor: '' },
        });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(3);
      expect(mockClient.users.conversations).toHaveBeenCalledTimes(3);
    });

    it('should return empty array when user has no channels', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [],
        response_metadata: { next_cursor: '' },
      });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(0);
    });

    it('should include all channel types (public, private, im, mpim)', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [
          { id: 'C001', name: 'public-ch', is_channel: true },
          { id: 'G001', name: 'private-ch', is_group: true },
          { id: 'D001', name: 'dm', is_im: true },
          { id: 'G002', name: 'group-dm', is_mpim: true },
        ],
        response_metadata: { next_cursor: '' },
      });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(4);
      expect(mockClient.users.conversations).toHaveBeenCalledWith(
        expect.objectContaining({
          types: 'public_channel,private_channel,im,mpim',
        })
      );
    });

    it('should handle undefined channels in response', async () => {
      mockClient.users.conversations.mockResolvedValue({
        response_metadata: { next_cursor: '' },
      });

      const result = await channelOps.fetchUserChannels();

      expect(result).toHaveLength(0);
    });
  });

  describe('resolveChannelId', () => {
    it('should reuse the cached channel list across resolutions', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general', is_channel: true, is_private: false, created: 1 },
          { id: 'C456', name: 'random', is_channel: true, is_private: false, created: 1 },
        ],
        response_metadata: { next_cursor: '' },
      });

      await expect(channelOps.resolveChannelId('general')).resolves.toBe('C123');
      await expect(channelOps.resolveChannelId('random')).resolves.toBe('C456');

      expect(mockClient.conversations.list).toHaveBeenCalledTimes(1);
    });

    it('should clear the cached promise after a lookup fetch failure', async () => {
      mockClient.conversations.list
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce({
          channels: [
            { id: 'C123', name: 'general', is_channel: true, is_private: false, created: 1 },
          ],
          response_metadata: { next_cursor: '' },
        });

      await expect(channelOps.resolveChannelId('general')).rejects.toThrow('temporary failure');
      await expect(channelOps.resolveChannelId('general')).resolves.toBe('C123');

      expect(mockClient.conversations.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('listUnreadChannels', () => {
    it('should use users.conversations instead of conversations.list', async () => {
      // Mock users.conversations response (used by fetchUserChannels)
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: { id: 'C123', name: 'general', last_read: '1234567890.000100' },
      });

      mockClient.conversations.history.mockResolvedValue({
        messages: [],
      });

      await channelOps.listUnreadChannels();

      // Should use users.conversations, NOT conversations.list
      expect(mockClient.users.conversations).toHaveBeenCalled();
      expect(mockClient.conversations.list).not.toHaveBeenCalled();
    });

    it('should detect unread messages when last_read is present', async () => {
      // Mock users.conversations response
      mockClient.users.conversations.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general' },
          { id: 'C456', name: 'random' },
        ],
        response_metadata: { next_cursor: '' },
      });

      // Mock conversations.info responses
      mockClient.conversations.info
        .mockResolvedValueOnce({
          channel: {
            id: 'C123',
            name: 'general',
            last_read: '1234567890.000100',
            unread_count: 2,
            unread_count_display: 2,
          },
        })
        .mockResolvedValueOnce({
          channel: {
            id: 'C456',
            name: 'random',
            last_read: '1234567890.000200',
            unread_count: 0,
            unread_count_display: 0,
          },
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
      // Mock users.conversations response
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C789', name: 'no-read-channel' }],
        response_metadata: { next_cursor: '' },
      });

      // Mock conversations.info response - no last_read
      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C789',
          name: 'no-read-channel',
          unread_count: 3,
          unread_count_display: 3,
        },
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
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C999', name: 'empty-channel' }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C999',
          name: 'empty-channel',
          last_read: '1234567890.000100',
          unread_count: 0,
          unread_count_display: 0,
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
    });

    it('should skip channels with all messages read', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C111', name: 'all-read' }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C111',
          name: 'all-read',
          last_read: '1234567890.000200',
          unread_count: 0,
          unread_count_display: 0,
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [
          { id: 'C222', name: 'error-channel' },
          { id: 'C333', name: 'good-channel' },
        ],
        response_metadata: { next_cursor: '' },
      });

      // First channel throws error
      mockClient.conversations.info
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          channel: {
            id: 'C333',
            name: 'good-channel',
            last_read: '1234567890.000100',
            unread_count: 1,
            unread_count_display: 1,
          },
        });

      const result = await channelOps.listUnreadChannels();

      // Should skip the error channel and process the good one
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('C333');
    });

    it('should handle rate limiting with delay', async () => {
      const delaySpy = vi.spyOn(
        channelOps as unknown as { delay: (ms: number) => Promise<void> },
        'delay'
      );

      mockClient.users.conversations.mockResolvedValue({
        channels: [
          { id: 'C444', name: 'channel1' },
          { id: 'C555', name: 'channel2' },
        ],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: { id: 'C444', name: 'channel1', unread_count: 0, unread_count_display: 0 },
      });

      await channelOps.listUnreadChannels();

      // Verify delay was called between API calls
      expect(delaySpy).toHaveBeenCalledWith(100);
    });

    it('should use unread counters from conversations.info for channel scans', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C777', name: 'busy-channel' }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C777',
          name: 'busy-channel',
          last_read: '1234567890.000100',
          unread_count: 3,
          unread_count_display: 3,
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C777',
        unread_count: 3,
        unread_count_display: 3,
      });
      expect(mockClient.conversations.history).not.toHaveBeenCalled();
    });

    it('should use channel name from conversations.info when users.conversations omits it', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'C888' }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C888',
          name: 'restored-name',
          unread_count: 1,
          unread_count_display: 1,
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C888',
        name: 'restored-name',
      });
    });

    it('should resolve DM display name when the conversation has no name', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'D999', is_im: true }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'D999',
          is_im: true,
          user: 'U999',
          unread_count: 2,
          unread_count_display: 2,
        },
      });

      mockClient.users.info.mockResolvedValue({
        user: {
          id: 'U999',
          name: 'alice',
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'D999',
        display_name: '@alice',
        name: 'D999',
      });
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U999' });
    });

    it('should sanitize resolved display names for unread conversations', async () => {
      mockClient.users.conversations.mockResolvedValue({
        channels: [{ id: 'D999', is_im: true }],
        response_metadata: { next_cursor: '' },
      });

      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'D999',
          is_im: true,
          user: 'U999',
          unread_count: 1,
          unread_count_display: 1,
        },
      });

      mockClient.users.info.mockResolvedValue({
        user: {
          id: 'U999',
          name: '\u001b[31malice',
        },
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('@alice');
      expect(result[0].display_name).not.toContain('\u001b');
    });
  });

  describe('listChannels', () => {
    it('should still use conversations.list for channel listing', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general' },
          { id: 'C456', name: 'random' },
        ],
      });

      const result = await channelOps.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100,
      });

      expect(result).toHaveLength(2);
      expect(mockClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100,
        cursor: undefined,
      });
      // Should NOT use users.conversations
      expect(mockClient.users.conversations).not.toHaveBeenCalled();
    });

    it('should handle pagination for conversations.list', async () => {
      mockClient.conversations.list
        .mockResolvedValueOnce({
          channels: [{ id: 'C001', name: 'ch1' }],
          response_metadata: { next_cursor: 'cursor2' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C002', name: 'ch2' }],
          response_metadata: { next_cursor: '' },
        });

      const result = await channelOps.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100,
      });

      expect(result).toHaveLength(2);
      expect(mockClient.conversations.list).toHaveBeenCalledTimes(2);
    });
  });
});
