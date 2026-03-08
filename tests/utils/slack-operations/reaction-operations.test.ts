import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import { ReactionOperations } from '../../../src/utils/slack-operations/reaction-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      reactions: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

describe('ReactionOperations', () => {
  type MockClient = {
    reactions: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };

  let reactionOps: ReactionOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    reactionOps = new ReactionOperations('test-token');
    mockClient = (reactionOps as unknown as { client: MockClient }).client;
  });

  describe('addReaction', () => {
    it('should add a reaction to a message', async () => {
      mockClient.reactions.add.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await reactionOps.addReaction('general', '1234567890.123456', 'thumbsup');

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.reactions.add).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });
    });

    it('should handle channel ID directly', async () => {
      mockClient.reactions.add.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await reactionOps.addReaction('C123456789', '1234567890.123456', 'eyes');

      expect(mockClient.reactions.add).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        name: 'eyes',
      });
    });

    it('should strip colons from emoji name', async () => {
      mockClient.reactions.add.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await reactionOps.addReaction('general', '1234567890.123456', ':thumbsup:');

      expect(mockClient.reactions.add).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });
    });

    it('should throw on API error', async () => {
      mockClient.reactions.add.mockRejectedValue(new Error('already_reacted'));
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await expect(
        reactionOps.addReaction('general', '1234567890.123456', 'thumbsup')
      ).rejects.toThrow('already_reacted');
    });
  });

  describe('removeReaction', () => {
    it('should remove a reaction from a message', async () => {
      mockClient.reactions.remove.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await reactionOps.removeReaction('general', '1234567890.123456', 'thumbsup');

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.reactions.remove).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });
    });

    it('should strip colons from emoji name', async () => {
      mockClient.reactions.remove.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await reactionOps.removeReaction('general', '1234567890.123456', ':eyes:');

      expect(mockClient.reactions.remove).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        name: 'eyes',
      });
    });

    it('should throw on API error', async () => {
      mockClient.reactions.remove.mockRejectedValue(new Error('no_reaction'));
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await expect(
        reactionOps.removeReaction('general', '1234567890.123456', 'thumbsup')
      ).rejects.toThrow('no_reaction');
    });
  });
});
