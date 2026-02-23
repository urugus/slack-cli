import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserOperations } from '../../../src/utils/slack-operations/user-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: {
      open: vi.fn(),
    },
    users: {
      list: vi.fn(),
      info: vi.fn(),
      lookupByEmail: vi.fn(),
    },
  })),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('p-limit', () => ({
  default: () => (fn: any) => fn(),
}));

describe('UserOperations - DM', () => {
  let userOps: UserOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        open: vi.fn(),
      },
      users: {
        list: vi.fn(),
        info: vi.fn(),
        lookupByEmail: vi.fn(),
      },
    };
    userOps = new UserOperations('test-token');
    (userOps as any).client = mockClient;
  });

  describe('openDmChannel', () => {
    it('should open a DM channel with a user ID', async () => {
      mockClient.conversations.open.mockResolvedValue({
        ok: true,
        channel: { id: 'D1234567890' },
      });

      const channelId = await userOps.openDmChannel('U1234567890');

      expect(channelId).toBe('D1234567890');
      expect(mockClient.conversations.open).toHaveBeenCalledWith({
        users: 'U1234567890',
      });
    });

    it('should throw when conversations.open fails', async () => {
      mockClient.conversations.open.mockRejectedValue(new Error('user_not_found'));

      await expect(userOps.openDmChannel('UINVALID123')).rejects.toThrow('user_not_found');
    });
  });

  describe('resolveUserIdByName', () => {
    it('should resolve user ID by display name', async () => {
      mockClient.users.list.mockResolvedValue({
        members: [
          { id: 'U111', name: 'john', profile: { display_name: 'John Doe' } },
          { id: 'U222', name: 'jane', profile: { display_name: 'Jane Smith' } },
        ],
        response_metadata: {},
      });

      const userId = await userOps.resolveUserIdByName('john');

      expect(userId).toBe('U111');
    });

    it('should resolve user ID by name without @ prefix', async () => {
      mockClient.users.list.mockResolvedValue({
        members: [
          { id: 'U111', name: 'john', profile: { display_name: 'John Doe' } },
        ],
        response_metadata: {},
      });

      const userId = await userOps.resolveUserIdByName('@john');

      expect(userId).toBe('U111');
    });

    it('should throw when user is not found', async () => {
      mockClient.users.list.mockResolvedValue({
        members: [
          { id: 'U111', name: 'john', profile: { display_name: 'John Doe' } },
        ],
        response_metadata: {},
      });

      await expect(userOps.resolveUserIdByName('unknown')).rejects.toThrow(
        "User 'unknown' not found"
      );
    });

    it('should match by display_name case-insensitively', async () => {
      mockClient.users.list.mockResolvedValue({
        members: [
          { id: 'U111', name: 'john.doe', profile: { display_name: 'John Doe' } },
        ],
        response_metadata: {},
      });

      const userId = await userOps.resolveUserIdByName('John Doe');

      expect(userId).toBe('U111');
    });
  });
});
