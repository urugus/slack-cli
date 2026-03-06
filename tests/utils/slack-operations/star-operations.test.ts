import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StarOperations } from '../../../src/utils/slack-operations/star-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      stars: {
        add: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

describe('StarOperations', () => {
  let starOps: StarOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    starOps = new StarOperations('test-token');
    mockClient = (starOps as any).client;
  });

  describe('addStar', () => {
    it('should add a star to a message', async () => {
      mockClient.stars.add.mockResolvedValue({ ok: true });

      await starOps.addStar('C1234567890', '1234567890.123456');

      expect(mockClient.stars.add).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
      });
    });

    it('should throw when add fails', async () => {
      mockClient.stars.add.mockRejectedValue(new Error('channel_not_found'));

      await expect(starOps.addStar('C1234567890', '1234567890.123456')).rejects.toThrow(
        'channel_not_found'
      );
    });
  });

  describe('listStars', () => {
    it('should list starred items with default count', async () => {
      const mockItems = [
        {
          type: 'message',
          channel: 'C1234567890',
          message: {
            text: 'Hello, world!',
            ts: '1234567890.123456',
          },
          date_create: 1709290800,
        },
      ];
      mockClient.stars.list.mockResolvedValue({
        ok: true,
        items: mockItems,
      });

      const result = await starOps.listStars();

      expect(mockClient.stars.list).toHaveBeenCalledWith({
        count: 100,
        cursor: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('message');
    });

    it('should list starred items with custom count', async () => {
      mockClient.stars.list.mockResolvedValue({
        ok: true,
        items: [],
      });

      await starOps.listStars(50);

      expect(mockClient.stars.list).toHaveBeenCalledWith({
        count: 50,
        cursor: undefined,
      });
    });

    it('should list starred items with cursor', async () => {
      mockClient.stars.list.mockResolvedValue({
        ok: true,
        items: [],
      });

      await starOps.listStars(100, 'next_cursor_value');

      expect(mockClient.stars.list).toHaveBeenCalledWith({
        count: 100,
        cursor: 'next_cursor_value',
      });
    });

    it('should return empty array when no items exist', async () => {
      mockClient.stars.list.mockResolvedValue({
        ok: true,
        items: [],
      });

      const result = await starOps.listStars();

      expect(result.items).toEqual([]);
    });

    it('should return empty array when items is undefined', async () => {
      mockClient.stars.list.mockResolvedValue({
        ok: true,
      });

      const result = await starOps.listStars();

      expect(result.items).toEqual([]);
    });
  });

  describe('removeStar', () => {
    it('should remove a star from a message', async () => {
      mockClient.stars.remove.mockResolvedValue({ ok: true });

      await starOps.removeStar('C1234567890', '1234567890.123456');

      expect(mockClient.stars.remove).toHaveBeenCalledWith({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
      });
    });

    it('should throw when remove fails', async () => {
      mockClient.stars.remove.mockRejectedValue(new Error('not_starred'));

      await expect(starOps.removeStar('C1234567890', '1234567890.123456')).rejects.toThrow(
        'not_starred'
      );
    });
  });
});
