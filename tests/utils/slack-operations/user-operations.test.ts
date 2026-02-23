import { beforeEach, describe, it, expect, vi } from 'vitest';
import { UserOperations } from '../../../src/utils/slack-operations/user-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
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

describe('UserOperations', () => {
  let userOps: UserOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    userOps = new UserOperations('test-token');
    mockClient = (userOps as any).client;
  });

  describe('listUsers', () => {
    it('should list users with pagination', async () => {
      mockClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U123',
            name: 'alice',
            real_name: 'Alice Smith',
            profile: { email: 'alice@example.com', display_name: 'alice' },
            is_bot: false,
            deleted: false,
          },
          {
            id: 'U456',
            name: 'bob',
            real_name: 'Bob Jones',
            profile: { email: 'bob@example.com', display_name: 'bob' },
            is_bot: false,
            deleted: false,
          },
        ],
        response_metadata: { next_cursor: '' },
      });

      const result = await userOps.listUsers();

      expect(mockClient.users.list).toHaveBeenCalledWith({
        limit: 200,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('U123');
      expect(result[1].id).toBe('U456');
    });

    it('should handle pagination with cursor', async () => {
      mockClient.users.list
        .mockResolvedValueOnce({
          ok: true,
          members: [
            { id: 'U123', name: 'alice', real_name: 'Alice', is_bot: false, deleted: false },
          ],
          response_metadata: { next_cursor: 'cursor123' },
        })
        .mockResolvedValueOnce({
          ok: true,
          members: [
            { id: 'U456', name: 'bob', real_name: 'Bob', is_bot: false, deleted: false },
          ],
          response_metadata: { next_cursor: '' },
        });

      const result = await userOps.listUsers();

      expect(mockClient.users.list).toHaveBeenCalledTimes(2);
      expect(mockClient.users.list).toHaveBeenNthCalledWith(2, {
        limit: 200,
        cursor: 'cursor123',
      });
      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      mockClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          { id: 'U123', name: 'alice', real_name: 'Alice', is_bot: false, deleted: false },
          { id: 'U456', name: 'bob', real_name: 'Bob', is_bot: false, deleted: false },
          { id: 'U789', name: 'charlie', real_name: 'Charlie', is_bot: false, deleted: false },
        ],
        response_metadata: { next_cursor: 'more' },
      });

      const result = await userOps.listUsers(2);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no members exist', async () => {
      mockClient.users.list.mockResolvedValue({
        ok: true,
        members: [],
        response_metadata: { next_cursor: '' },
      });

      const result = await userOps.listUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getUserInfo', () => {
    it('should get user info by ID', async () => {
      mockClient.users.info.mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: {
            email: 'alice@example.com',
            display_name: 'alice',
            title: 'Engineer',
            status_text: 'Working',
            status_emoji: ':computer:',
          },
          tz: 'Asia/Tokyo',
          tz_label: 'Japan Standard Time',
          is_admin: false,
          is_bot: false,
          deleted: false,
        },
      });

      const result = await userOps.getUserInfo('U123');

      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U123' });
      expect(result.id).toBe('U123');
      expect(result.name).toBe('alice');
      expect(result.real_name).toBe('Alice Smith');
    });

    it('should throw when user not found', async () => {
      mockClient.users.info.mockRejectedValue(new Error('user_not_found'));

      await expect(userOps.getUserInfo('UINVALID')).rejects.toThrow('user_not_found');
    });
  });

  describe('lookupByEmail', () => {
    it('should find user by email', async () => {
      mockClient.users.lookupByEmail.mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: { email: 'alice@example.com', display_name: 'alice' },
        },
      });

      const result = await userOps.lookupByEmail('alice@example.com');

      expect(mockClient.users.lookupByEmail).toHaveBeenCalledWith({
        email: 'alice@example.com',
      });
      expect(result.id).toBe('U123');
      expect(result.name).toBe('alice');
    });

    it('should throw when email not found', async () => {
      mockClient.users.lookupByEmail.mockRejectedValue(new Error('users_not_found'));

      await expect(userOps.lookupByEmail('notfound@example.com')).rejects.toThrow(
        'users_not_found'
      );
    });
  });
});
