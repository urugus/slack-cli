import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        setTopic: vi.fn(),
        setPurpose: vi.fn(),
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

describe('ChannelOperations - topic/purpose', () => {
  let channelOps: ChannelOperations;
  let mockClient: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        setTopic: vi.fn(),
        setPurpose: vi.fn(),
      },
    };
    channelOps = new ChannelOperations('test-token');
    (channelOps as Record<string, unknown>)['client'] = mockClient;
  });

  describe('setTopic', () => {
    it('should set channel topic with channel name resolution', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
      });
      mockClient.conversations.setTopic.mockResolvedValue({
        ok: true,
        channel: { id: 'C123', topic: { value: 'New topic' } },
      });

      await channelOps.setTopic('general', 'New topic');

      expect(mockClient.conversations.setTopic).toHaveBeenCalledWith({
        channel: 'C123',
        topic: 'New topic',
      });
    });

    it('should set topic with channel ID directly', async () => {
      mockClient.conversations.setTopic.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890', topic: { value: 'Updated topic' } },
      });

      await channelOps.setTopic('C1234567890', 'Updated topic');

      expect(mockClient.conversations.setTopic).toHaveBeenCalledWith({
        channel: 'C1234567890',
        topic: 'Updated topic',
      });
      // Should not call list when given a channel ID
      expect(mockClient.conversations.list).not.toHaveBeenCalled();
    });
  });

  describe('setPurpose', () => {
    it('should set channel purpose with channel name resolution', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C456', name: 'random' }],
      });
      mockClient.conversations.setPurpose.mockResolvedValue({
        ok: true,
        channel: { id: 'C456', purpose: { value: 'New purpose' } },
      });

      await channelOps.setPurpose('random', 'New purpose');

      expect(mockClient.conversations.setPurpose).toHaveBeenCalledWith({
        channel: 'C456',
        purpose: 'New purpose',
      });
    });
  });

  describe('getChannelDetail', () => {
    it('should return channel detail with topic, purpose, and member count', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
      });
      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C123',
          name: 'general',
          is_private: false,
          is_archived: false,
          created: 1579075200,
          num_members: 42,
          topic: { value: 'Current topic', creator: 'U111', last_set: 1700000000 },
          purpose: { value: 'Current purpose', creator: 'U222', last_set: 1700000001 },
        },
      });

      const result = await channelOps.getChannelDetail('general');

      expect(result).toEqual({
        id: 'C123',
        name: 'general',
        is_private: false,
        is_archived: false,
        created: 1579075200,
        num_members: 42,
        topic: { value: 'Current topic', creator: 'U111', last_set: 1700000000 },
        purpose: { value: 'Current purpose', creator: 'U222', last_set: 1700000001 },
      });
    });

    it('should include num_members in the API call', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
      });
      mockClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C123',
          name: 'general',
          is_private: false,
          created: 1579075200,
        },
      });

      await channelOps.getChannelDetail('general');

      expect(mockClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C123',
        include_num_members: true,
      });
    });
  });
});
