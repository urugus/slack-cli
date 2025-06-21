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
});