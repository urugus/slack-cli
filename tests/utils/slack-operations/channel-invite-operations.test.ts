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
        invite: vi.fn(),
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

describe('ChannelOperations - invite', () => {
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
        invite: vi.fn(),
      },
    };
    channelOps = new ChannelOperations('test-token');
    (channelOps as any).client = mockClient;
  });

  describe('inviteToChannel', () => {
    it('should invite users to a channel with channel name resolution', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [{ id: 'C123', name: 'general' }],
      });
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: 'C123' },
      });

      await channelOps.inviteToChannel('general', ['U12345']);

      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C123',
        users: 'U12345',
      });
    });

    it('should invite users to a channel with channel ID directly', async () => {
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890' },
      });

      await channelOps.inviteToChannel('C1234567890', ['U12345']);

      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C1234567890',
        users: 'U12345',
      });
      // Should not call list when given a channel ID
      expect(mockClient.conversations.list).not.toHaveBeenCalled();
    });

    it('should throw error when channel is not found', async () => {
      mockClient.conversations.list.mockResolvedValue({
        channels: [],
      });

      await expect(channelOps.inviteToChannel('nonexistent', ['U12345'])).rejects.toThrow();
    });

    it('should propagate already_in_channel error', async () => {
      mockClient.conversations.invite.mockRejectedValue(new Error('already_in_channel'));

      await expect(channelOps.inviteToChannel('C1234567890', ['U12345'])).rejects.toThrow(
        'already_in_channel'
      );
    });

    it('should propagate cant_invite error', async () => {
      mockClient.conversations.invite.mockRejectedValue(new Error('cant_invite'));

      await expect(channelOps.inviteToChannel('C1234567890', ['U12345'])).rejects.toThrow(
        'cant_invite'
      );
    });

    it('should join multiple user IDs with commas', async () => {
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890' },
      });

      await channelOps.inviteToChannel('C1234567890', ['U12345', 'U67890', 'U11111']);

      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C1234567890',
        users: 'U12345,U67890,U11111',
      });
    });

    it('should pass force option when specified', async () => {
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890' },
      });

      await channelOps.inviteToChannel('C1234567890', ['U12345', 'U67890'], true);

      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C1234567890',
        users: 'U12345,U67890',
        force: true,
      });
    });

    it('should not include force when not specified', async () => {
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: 'C1234567890' },
      });

      await channelOps.inviteToChannel('C1234567890', ['U12345']);

      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C1234567890',
        users: 'U12345',
      });
    });
  });
});
