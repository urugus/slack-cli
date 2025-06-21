import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { WebClient } from '@slack/web-api';

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
        list: vi.fn()
      }
    };
    vi.mocked(WebClient).mockReturnValue(mockWebClient);
    client = new SlackApiClient('test-token');
  });

  describe('constructor', () => {
    it('should create WebClient with provided token', () => {
      expect(WebClient).toHaveBeenCalledWith('test-token');
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
  });
});