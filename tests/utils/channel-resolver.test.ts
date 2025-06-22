import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelResolver } from '../../src/utils/channel-resolver';
import { Channel } from '../../src/utils/slack-api-client';

describe('ChannelResolver', () => {
  let resolver: ChannelResolver;
  let mockChannels: Channel[];

  beforeEach(() => {
    resolver = new ChannelResolver();
    mockChannels = [
      {
        id: 'C123',
        name: 'general',
        is_private: false,
        created: 1234567890,
        is_member: true,
      },
      {
        id: 'C456',
        name: 'random',
        is_private: false,
        created: 1234567890,
        is_member: true,
      },
      {
        id: 'C789',
        name: 'dev-team',
        is_private: false,
        created: 1234567890,
        is_member: true,
        name_normalized: 'dev-team',
      },
      {
        id: 'G123',
        name: 'private-channel',
        is_private: true,
        created: 1234567890,
        is_member: true,
      },
    ];
  });

  describe('isChannelId', () => {
    it('should identify channel IDs starting with C', () => {
      expect(resolver.isChannelId('C123456')).toBe(true);
    });

    it('should identify DM IDs starting with D', () => {
      expect(resolver.isChannelId('D123456')).toBe(true);
    });

    it('should identify group IDs starting with G', () => {
      expect(resolver.isChannelId('G123456')).toBe(true);
    });

    it('should return false for channel names', () => {
      expect(resolver.isChannelId('general')).toBe(false);
      expect(resolver.isChannelId('#general')).toBe(false);
    });
  });

  describe('findChannel', () => {
    it('should find channel by exact name match', () => {
      const result = resolver.findChannel('general', mockChannels);
      expect(result).toEqual(mockChannels[0]);
    });

    it('should find channel by name without # prefix', () => {
      const result = resolver.findChannel('#general', mockChannels);
      expect(result).toEqual(mockChannels[0]);
    });

    it('should find channel by case-insensitive match', () => {
      const result = resolver.findChannel('GENERAL', mockChannels);
      expect(result).toEqual(mockChannels[0]);
    });

    it('should find channel by normalized name', () => {
      const result = resolver.findChannel('dev-team', mockChannels);
      expect(result).toEqual(mockChannels[2]);
    });

    it('should return undefined when channel not found', () => {
      const result = resolver.findChannel('nonexistent', mockChannels);
      expect(result).toBeUndefined();
    });
  });

  describe('getSimilarChannels', () => {
    it('should find similar channels by partial match', () => {
      const result = resolver.getSimilarChannels('gen', mockChannels);
      expect(result).toEqual(['general']);
    });

    it('should limit results to specified count', () => {
      const manyChannels = [
        ...mockChannels,
        { id: 'C999', name: 'general-2', is_private: false, created: 0 },
        { id: 'C888', name: 'general-3', is_private: false, created: 0 },
      ];
      const result = resolver.getSimilarChannels('general', manyChannels, 2);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no similar channels found', () => {
      const result = resolver.getSimilarChannels('xyz', mockChannels);
      expect(result).toEqual([]);
    });
  });

  describe('resolveChannelError', () => {
    it('should create error with suggestions when similar channels exist', () => {
      const error = resolver.resolveChannelError('genera', mockChannels);
      expect(error.message).toContain("Channel 'genera' not found");
      expect(error.message).toContain('Did you mean one of these?');
      expect(error.message).toContain('general');
    });

    it('should create error without suggestions when no similar channels', () => {
      const error = resolver.resolveChannelError('xyz', mockChannels);
      expect(error.message).toContain("Channel 'xyz' not found");
      expect(error.message).toContain('Make sure you are a member of this channel');
      expect(error.message).not.toContain('Did you mean');
    });
  });

  describe('resolveChannelId', () => {
    it('should return ID directly if already an ID', async () => {
      const getChannelsFn = vi.fn();
      const result = await resolver.resolveChannelId('C123456', getChannelsFn);
      expect(result).toBe('C123456');
      expect(getChannelsFn).not.toHaveBeenCalled();
    });

    it('should resolve channel name to ID', async () => {
      const getChannelsFn = vi.fn().mockResolvedValue(mockChannels);
      const result = await resolver.resolveChannelId('general', getChannelsFn);
      expect(result).toBe('C123');
      expect(getChannelsFn).toHaveBeenCalled();
    });

    it('should throw error when channel not found', async () => {
      const getChannelsFn = vi.fn().mockResolvedValue(mockChannels);
      await expect(resolver.resolveChannelId('nonexistent', getChannelsFn)).rejects.toThrow(
        "Channel 'nonexistent' not found"
      );
    });

    it('should include suggestions in error when similar channels exist', async () => {
      const getChannelsFn = vi.fn().mockResolvedValue(mockChannels);
      await expect(resolver.resolveChannelId('genera', getChannelsFn)).rejects.toThrow(
        'Did you mean one of these? general'
      );
    });
  });
});