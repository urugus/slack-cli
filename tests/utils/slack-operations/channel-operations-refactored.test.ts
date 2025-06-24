import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';
import { WebClient } from '@slack/web-api';

vi.mock('@slack/web-api');

describe('ChannelOperations - refactored listUnreadChannels', () => {
  let channelOps: ChannelOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
      },
    };
    channelOps = new ChannelOperations(mockClient as WebClient);
  });

  describe('listUnreadChannels', () => {
    it('should fetch unread channels with proper separation of concerns', async () => {
      const mockChannels = [
        { id: 'C1', name: 'general' },
        { id: 'C2', name: 'random' },
      ];

      mockClient.conversations.list.mockResolvedValueOnce({
        channels: mockChannels,
      });

      // Channel 1 - has unread messages
      mockClient.conversations.info.mockResolvedValueOnce({
        channel: { id: 'C1', last_read: '1234567890.000000' },
      });
      mockClient.conversations.history
        .mockResolvedValueOnce({ messages: [{ ts: '1234567900.000000' }] }) // latest message
        .mockResolvedValueOnce({ messages: [{ ts: '1234567900.000000' }, { ts: '1234567895.000000' }] }); // messages after last_read

      // Channel 2 - no unread messages
      mockClient.conversations.info.mockResolvedValueOnce({
        channel: { id: 'C2', last_read: '1234567900.000000' },
      });
      mockClient.conversations.history
        .mockResolvedValueOnce({ messages: [{ ts: '1234567890.000000' }] }) // latest message
        .mockResolvedValueOnce({ messages: [] }); // no messages after last_read

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C1',
        name: 'general',
        unread_count: 2,
        unread_count_display: 2,
      });

      // Verify the separation of concerns - each method is called appropriately
      expect(mockClient.conversations.list).toHaveBeenCalledOnce();
      expect(mockClient.conversations.info).toHaveBeenCalledTimes(2);
      expect(mockClient.conversations.history).toHaveBeenCalledTimes(4);
    });

    it('should handle channels with no last_read timestamp', async () => {
      const mockChannels = [
        { id: 'C1', name: 'general' },
      ];

      mockClient.conversations.list.mockResolvedValueOnce({
        channels: mockChannels,
      });

      mockClient.conversations.info.mockResolvedValueOnce({
        channel: { id: 'C1' }, // no last_read
      });

      mockClient.conversations.history
        .mockResolvedValueOnce({ messages: [{ ts: '1234567900.000000' }] }) // check if has messages
        .mockResolvedValueOnce({ 
          messages: [
            { ts: '1234567900.000000' },
            { ts: '1234567895.000000' },
            { ts: '1234567890.000000' },
          ]
        }); // all messages are unread

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'C1',
        name: 'general',
        unread_count: 3,
        unread_count_display: 3,
      });
    });

    it('should skip channels with no messages', async () => {
      const mockChannels = [
        { id: 'C1', name: 'general' },
      ];

      mockClient.conversations.list.mockResolvedValueOnce({
        channels: mockChannels,
      });

      mockClient.conversations.info.mockResolvedValueOnce({
        channel: { id: 'C1', last_read: '1234567890.000000' },
      });

      mockClient.conversations.history
        .mockResolvedValueOnce({ messages: [] }); // no messages at all

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
    });

    it('should handle rate limit errors gracefully', async () => {
      const mockChannels = [
        { id: 'C1', name: 'general' },
        { id: 'C2', name: 'random' },
      ];

      mockClient.conversations.list.mockResolvedValueOnce({
        channels: mockChannels,
      });

      // Channel 1 - rate limited
      mockClient.conversations.info.mockRejectedValueOnce(new Error('rate_limited'));

      // Channel 2 - successful
      mockClient.conversations.info.mockResolvedValueOnce({
        channel: { id: 'C2', last_read: '1234567890.000000' },
      });
      mockClient.conversations.history
        .mockResolvedValueOnce({ messages: [{ ts: '1234567900.000000' }] })
        .mockResolvedValueOnce({ messages: [{ ts: '1234567900.000000' }] });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('C2');
    });
  });

  describe('private methods (indirectly tested)', () => {
    it('fetchAllChannels should handle large channel lists', async () => {
      const mockChannels = [
        { id: 'C1', name: 'channel-1' },
        { id: 'C2', name: 'channel-2' },
        { id: 'C3', name: 'channel-3' },
      ];

      mockClient.conversations.list.mockResolvedValueOnce({
        channels: mockChannels,
      });

      // Mock all channels having no unread messages for simplicity
      mockChannels.forEach(() => {
        mockClient.conversations.info.mockResolvedValueOnce({
          channel: { last_read: '9999999999.000000' },
        });
        mockClient.conversations.history.mockResolvedValueOnce({ messages: [] });
      });

      const result = await channelOps.listUnreadChannels();

      expect(result).toHaveLength(0);
      expect(mockClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 1000,
      });
    });
  });
});