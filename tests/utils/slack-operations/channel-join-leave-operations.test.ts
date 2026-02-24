import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        join: vi.fn(),
        leave: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('p-limit', () => ({
  default: () => (fn: any) => fn(),
}));

describe('ChannelOperations - join/leave', () => {
  let channelOps: ChannelOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        join: vi.fn(),
        leave: vi.fn(),
      },
    };
    channelOps = new ChannelOperations('test-token');
    (channelOps as any).client = mockClient;
  });

  describe('joinChannel', () => {
    it('should join a channel with channel name resolution', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
      });
      mockClient.conversations.join.mockResolvedValue({
        ok: true,
        channel: { id: 'C123' },
      });

      await channelOps.joinChannel('general');

      expect(mockClient.conversations.join).toHaveBeenCalledWith({
        channel: 'C123',
      });
    });

    it('should join a channel with channel ID directly', async () => {
      mockClient.conversations.join.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890' },
      });

      await channelOps.joinChannel('C1234567890');

      expect(mockClient.conversations.join).toHaveBeenCalledWith({
        channel: 'C1234567890',
      });
      // Should not call list when given a channel ID
      expect(mockClient.conversations.list).not.toHaveBeenCalled();
    });

    it('should throw error when channel is not found', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [],
      });

      await expect(channelOps.joinChannel('nonexistent')).rejects.toThrow();
    });

    it('should propagate API errors', async () => {
      mockClient.conversations.join.mockRejectedValue(new Error('is_archived'));

      await expect(channelOps.joinChannel('C1234567890')).rejects.toThrow('is_archived');
    });
  });

  describe('leaveChannel', () => {
    it('should leave a channel with channel name resolution', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C456', name: 'random' }],
      });
      mockClient.conversations.leave.mockResolvedValue({
        ok: true,
      });

      await channelOps.leaveChannel('random');

      expect(mockClient.conversations.leave).toHaveBeenCalledWith({
        channel: 'C456',
      });
    });

    it('should leave a channel with channel ID directly', async () => {
      mockClient.conversations.leave.mockResolvedValue({
        ok: true,
      });

      await channelOps.leaveChannel('C1234567890');

      expect(mockClient.conversations.leave).toHaveBeenCalledWith({
        channel: 'C1234567890',
      });
      expect(mockClient.conversations.list).not.toHaveBeenCalled();
    });

    it('should throw error when channel is not found', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [],
      });

      await expect(channelOps.leaveChannel('nonexistent')).rejects.toThrow();
    });

    it('should propagate cant_leave_general error', async () => {
      mockClient.conversations.leave.mockRejectedValue(new Error('cant_leave_general'));

      await expect(channelOps.leaveChannel('C1234567890')).rejects.toThrow('cant_leave_general');
    });

    it('should propagate last_member error', async () => {
      mockClient.conversations.leave.mockRejectedValue(new Error('last_member'));

      await expect(channelOps.leaveChannel('C1234567890')).rejects.toThrow('last_member');
    });
  });
});
