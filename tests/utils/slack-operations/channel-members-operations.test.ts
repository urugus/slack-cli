import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChannelOperations } from '../../../src/utils/slack-operations/channel-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        members: vi.fn(),
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

describe('ChannelOperations - getChannelMembers', () => {
  let channelOps: ChannelOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        list: vi.fn(),
        info: vi.fn(),
        history: vi.fn(),
        members: vi.fn(),
      },
    };
    channelOps = new ChannelOperations('test-token');
    (channelOps as any).client = mockClient;
  });

  it('should return member IDs for a channel', async () => {
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: ['U01ABCDEF', 'U02GHIJKL'],
      response_metadata: { next_cursor: '' },
    });

    const result = await channelOps.getChannelMembers('C1234567890');

    expect(result.members).toEqual(['U01ABCDEF', 'U02GHIJKL']);
    expect(result.nextCursor).toBe('');
    expect(mockClient.conversations.members).toHaveBeenCalledWith({
      channel: 'C1234567890',
      limit: 100,
      cursor: undefined,
    });
  });

  it('should pass limit parameter', async () => {
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: ['U01ABCDEF'],
      response_metadata: { next_cursor: '' },
    });

    await channelOps.getChannelMembers('C1234567890', { limit: 50 });

    expect(mockClient.conversations.members).toHaveBeenCalledWith({
      channel: 'C1234567890',
      limit: 50,
      cursor: undefined,
    });
  });

  it('should pass cursor for pagination', async () => {
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: ['U03MNOPQR'],
      response_metadata: { next_cursor: '' },
    });

    await channelOps.getChannelMembers('C1234567890', {
      cursor: 'dXNlcjpVMDYxTkZUVDI=',
    });

    expect(mockClient.conversations.members).toHaveBeenCalledWith({
      channel: 'C1234567890',
      limit: 100,
      cursor: 'dXNlcjpVMDYxTkZUVDI=',
    });
  });

  it('should return next_cursor when more pages exist', async () => {
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: ['U01ABCDEF', 'U02GHIJKL'],
      response_metadata: { next_cursor: 'dXNlcjpVMDYxTkZUVDI=' },
    });

    const result = await channelOps.getChannelMembers('C1234567890');

    expect(result.members).toEqual(['U01ABCDEF', 'U02GHIJKL']);
    expect(result.nextCursor).toBe('dXNlcjpVMDYxTkZUVDI=');
  });

  it('should return empty members array when channel has no members', async () => {
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: [],
      response_metadata: { next_cursor: '' },
    });

    const result = await channelOps.getChannelMembers('C1234567890');

    expect(result.members).toEqual([]);
    expect(result.nextCursor).toBe('');
  });

  it('should resolve channel name to ID before calling API', async () => {
    mockClient.conversations.list.mockResolvedValue({
      channels: [{ id: 'C1234567890', name: 'general' }],
    });
    mockClient.conversations.members.mockResolvedValue({
      ok: true,
      members: ['U01ABCDEF'],
      response_metadata: { next_cursor: '' },
    });

    const result = await channelOps.getChannelMembers('general');

    expect(result.members).toEqual(['U01ABCDEF']);
    expect(mockClient.conversations.members).toHaveBeenCalledWith({
      channel: 'C1234567890',
      limit: 100,
      cursor: undefined,
    });
  });

  it('should propagate API errors', async () => {
    mockClient.conversations.members.mockRejectedValue(
      new Error('channel_not_found')
    );

    await expect(
      channelOps.getChannelMembers('C1234567890')
    ).rejects.toThrow('channel_not_found');
  });
});
