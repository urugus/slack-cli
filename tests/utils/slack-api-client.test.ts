import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { WebClient, LogLevel } from '@slack/web-api';

vi.mock('@slack/web-api');

describe('SlackApiClient', () => {
  let client: SlackApiClient;
  let mockWebClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebClient = {
      chat: {
        postMessage: vi.fn()
      },
      conversations: {
        list: vi.fn(),
        info: vi.fn()
      },
      users: {
        conversations: vi.fn()
      }
    };
    vi.mocked(WebClient).mockReturnValue(mockWebClient);
    client = new SlackApiClient('test-token');
  });

  describe('constructor', () => {
    it('should create WebClient with provided token', () => {
      expect(WebClient).toHaveBeenCalledWith('test-token', {
        retryConfig: {
          retries: 0, // Disabled to handle rate limits manually
        },
        logLevel: LogLevel.ERROR,
      });
    });
  });

  describe('sendMessage', () => {
    it('should send message to channel', async () => {
      const mockResponse = { ok: true, ts: '1234567890.123456' };
      vi.mocked(mockWebClient.chat.postMessage).mockResolvedValue(mockResponse as any);

      const result = await client.sendMessage('general', 'Hello, World!');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'general',
        text: 'Hello, World!'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle channel ID format', async () => {
      const mockResponse = { ok: true, ts: '1234567890.123456' };
      vi.mocked(mockWebClient.chat.postMessage).mockResolvedValue(mockResponse as any);

      await client.sendMessage('C1234567890', 'Hello!');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'Hello!'
      });
    });

    it('should handle multi-line messages', async () => {
      const mockResponse = { ok: true, ts: '1234567890.123456' };
      vi.mocked(mockWebClient.chat.postMessage).mockResolvedValue(mockResponse as any);

      const multiLineMessage = 'Line 1\nLine 2\nLine 3';
      await client.sendMessage('general', multiLineMessage);

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'general',
        text: multiLineMessage
      });
    });

    it('should throw error on API failure', async () => {
      const mockError = new Error('channel_not_found');
      vi.mocked(mockWebClient.chat.postMessage).mockRejectedValue(mockError);

      await expect(client.sendMessage('nonexistent', 'Hello')).rejects.toThrow('channel_not_found');
    });
  });

  describe('listChannels', () => {
    it('should list channels with default options', async () => {
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
      vi.mocked(mockWebClient.conversations.list).mockResolvedValue({
        ok: true,
        channels: mockChannels
      } as any);

      const result = await client.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100
      });

      expect(mockWebClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100
      });
      expect(result).toEqual(mockChannels);
    });

    it('should handle private channels', async () => {
      const mockChannels = [
        {
          id: 'G1234567890',
          name: 'private-channel',
          is_group: true,
          is_private: true,
          num_members: 10,
          created: 1579075200,
          purpose: { value: 'Private discussions' }
        }
      ];
      vi.mocked(mockWebClient.conversations.list).mockResolvedValue({
        ok: true,
        channels: mockChannels
      } as any);

      const result = await client.listChannels({
        types: 'private_channel',
        exclude_archived: true,
        limit: 50
      });

      expect(mockWebClient.conversations.list).toHaveBeenCalledWith({
        types: 'private_channel',
        exclude_archived: true,
        limit: 50
      });
      expect(result).toEqual(mockChannels);
    });

    it('should handle multiple channel types', async () => {
      vi.mocked(mockWebClient.conversations.list).mockResolvedValue({
        ok: true,
        channels: []
      } as any);

      await client.listChannels({
        types: 'public_channel,private_channel,im',
        exclude_archived: false,
        limit: 200
      });

      expect(mockWebClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel,private_channel,im',
        exclude_archived: false,
        limit: 200
      });
    });

    it('should handle API errors', async () => {
      vi.mocked(mockWebClient.conversations.list).mockRejectedValue(new Error('invalid_auth'));

      await expect(client.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100
      })).rejects.toThrow('invalid_auth');
    });

    it('should handle pagination when listing channels', async () => {
      // First page
      vi.mocked(mockWebClient.conversations.list).mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: 'C001', name: 'channel1', is_private: false },
          { id: 'C002', name: 'channel2', is_private: false }
        ],
        response_metadata: {
          next_cursor: 'cursor123'
        }
      } as any);

      // Second page
      vi.mocked(mockWebClient.conversations.list).mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: 'C003', name: 'channel3', is_private: false },
          { id: 'C004', name: 'channel4', is_private: false }
        ],
        response_metadata: {
          next_cursor: 'cursor456'
        }
      } as any);

      // Third page (last page)
      vi.mocked(mockWebClient.conversations.list).mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: 'C005', name: 'channel5', is_private: false }
        ],
        response_metadata: {
          next_cursor: ''
        }
      } as any);

      const result = await client.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 2
      });

      // Should have called the API 3 times
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(3);

      // First call
      expect(mockWebClient.conversations.list).toHaveBeenNthCalledWith(1, {
        types: 'public_channel',
        exclude_archived: true,
        limit: 2,
        cursor: undefined
      });

      // Second call
      expect(mockWebClient.conversations.list).toHaveBeenNthCalledWith(2, {
        types: 'public_channel',
        exclude_archived: true,
        limit: 2,
        cursor: 'cursor123'
      });

      // Third call
      expect(mockWebClient.conversations.list).toHaveBeenNthCalledWith(3, {
        types: 'public_channel',
        exclude_archived: true,
        limit: 2,
        cursor: 'cursor456'
      });

      // Should return all channels
      expect(result).toHaveLength(5);
      expect(result[0].name).toBe('channel1');
      expect(result[1].name).toBe('channel2');
      expect(result[2].name).toBe('channel3');
      expect(result[3].name).toBe('channel4');
      expect(result[4].name).toBe('channel5');
    });

    it('should handle empty cursor in pagination', async () => {
      vi.mocked(mockWebClient.conversations.list).mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: 'C001', name: 'channel1', is_private: false }
        ],
        response_metadata: {
          // No next_cursor field
        }
      } as any);

      const result = await client.listChannels({
        types: 'public_channel',
        exclude_archived: true,
        limit: 100
      });

      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});