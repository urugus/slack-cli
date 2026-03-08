import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PinOperations } from '../../../src/utils/slack-operations/pin-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      pins: {
        add: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

import { channelResolver } from '../../../src/utils/channel-resolver';

describe('PinOperations', () => {
  let pinOps: PinOperations;
  let mockClient: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinOps = new PinOperations('test-token');
    mockClient = (pinOps as Record<string, unknown>)['client'];
  });

  describe('addPin', () => {
    it('should add a pin to a message', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.add.mockResolvedValue({ ok: true });

      await pinOps.addPin('general', '1234567890.123456');

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.pins.add).toHaveBeenCalledWith({
        channel: 'C123456',
        timestamp: '1234567890.123456',
      });
    });

    it('should handle channel ID directly', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.add.mockResolvedValue({ ok: true });

      await pinOps.addPin('C123456', '1234567890.123456');

      expect(mockClient.pins.add).toHaveBeenCalledWith({
        channel: 'C123456',
        timestamp: '1234567890.123456',
      });
    });

    it('should throw when pin add fails', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.add.mockRejectedValue(new Error('already_pinned'));

      await expect(pinOps.addPin('general', '1234567890.123456')).rejects.toThrow('already_pinned');
    });
  });

  describe('removePin', () => {
    it('should remove a pin from a message', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.remove.mockResolvedValue({ ok: true });

      await pinOps.removePin('general', '1234567890.123456');

      expect(mockClient.pins.remove).toHaveBeenCalledWith({
        channel: 'C123456',
        timestamp: '1234567890.123456',
      });
    });

    it('should throw when pin remove fails', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.remove.mockRejectedValue(new Error('no_pin'));

      await expect(pinOps.removePin('general', '1234567890.123456')).rejects.toThrow('no_pin');
    });
  });

  describe('listPins', () => {
    it('should list pinned items in a channel', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.list.mockResolvedValue({
        ok: true,
        items: [
          {
            type: 'message',
            created: 1700000000,
            created_by: 'U123',
            message: {
              text: 'Pinned message 1',
              user: 'U123',
              ts: '1234567890.123456',
            },
          },
          {
            type: 'message',
            created: 1700000100,
            created_by: 'U456',
            message: {
              text: 'Pinned message 2',
              user: 'U456',
              ts: '1234567891.123456',
            },
          },
        ],
      });

      const result = await pinOps.listPins('general');

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.pins.list).toHaveBeenCalledWith({
        channel: 'C123456',
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'message',
        created: 1700000000,
        created_by: 'U123',
        message: {
          text: 'Pinned message 1',
          user: 'U123',
          ts: '1234567890.123456',
        },
      });
    });

    it('should return empty array when no pins exist', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.list.mockResolvedValue({
        ok: true,
        items: [],
      });

      const result = await pinOps.listPins('general');

      expect(result).toEqual([]);
    });

    it('should return empty array when items is undefined', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456');
      mockClient.pins.list.mockResolvedValue({
        ok: true,
      });

      const result = await pinOps.listPins('general');

      expect(result).toEqual([]);
    });
  });
});
