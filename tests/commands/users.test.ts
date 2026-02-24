import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupUsersCommand } from '../../src/commands/users';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('users command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockReturnValue(mockSlackClient);

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupUsersCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('list subcommand', () => {
    it('should list users in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue([
        {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: { email: 'alice@example.com', display_name: 'alice' },
          is_bot: false,
          deleted: false,
        },
      ]);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list']);

      expect(mockSlackClient.listUsers).toHaveBeenCalledWith(100);
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should list users in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const users = [
        {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: { email: 'alice@example.com', display_name: 'alice' },
          is_bot: false,
          deleted: false,
        },
      ];
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue(users);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list', '--format', 'json']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(users, null, 2));
    });

    it('should list users in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue([
        {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: { email: 'alice@example.com', display_name: 'alice' },
          is_bot: false,
          deleted: false,
        },
      ]);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list', '--format', 'simple']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('U123'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('alice'));
    });

    it('should show message when no users found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No users found');
    });

    it('should respect limit option', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list', '--limit', '50']);

      expect(mockSlackClient.listUsers).toHaveBeenCalledWith(50);
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listUsers).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'list',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('info subcommand', () => {
    it('should display user info', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserInfo).mockResolvedValue({
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
      });

      await program.parseAsync(['node', 'slack-cli', 'users', 'info', '--id', 'U123']);

      expect(mockSlackClient.getUserInfo).toHaveBeenCalledWith('U123');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should display user info in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const user = {
        id: 'U123',
        name: 'alice',
        real_name: 'Alice Smith',
        profile: { email: 'alice@example.com', display_name: 'alice' },
        is_bot: false,
        deleted: false,
      };
      vi.mocked(mockSlackClient.getUserInfo).mockResolvedValue(user);

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'info',
        '--id',
        'U123',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(user, null, 2));
    });

    it('should handle user not found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserInfo).mockRejectedValue(new Error('user_not_found'));

      await program.parseAsync(['node', 'slack-cli', 'users', 'info', '--id', 'UINVALID']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('lookup subcommand', () => {
    it('should look up user by email', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.lookupUserByEmail).mockResolvedValue({
        id: 'U123',
        name: 'alice',
        real_name: 'Alice Smith',
        profile: { email: 'alice@example.com', display_name: 'alice' },
        is_bot: false,
        deleted: false,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'lookup',
        '--email',
        'alice@example.com',
      ]);

      expect(mockSlackClient.lookupUserByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should output lookup result in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const user = {
        id: 'U123',
        name: 'alice',
        real_name: 'Alice Smith',
        profile: { email: 'alice@example.com', display_name: 'alice' },
        is_bot: false,
        deleted: false,
      };
      vi.mocked(mockSlackClient.lookupUserByEmail).mockResolvedValue(user);

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'lookup',
        '--email',
        'alice@example.com',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(user, null, 2));
    });

    it('should handle email not found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.lookupUserByEmail).mockRejectedValue(
        new Error('users_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'lookup',
        '--email',
        'notfound@example.com',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('presence subcommand', () => {
    it('should display user presence by id in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue({
        presence: 'active',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'U123',
      ]);

      expect(mockSlackClient.getUserPresence).toHaveBeenCalledWith('U123');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should display user presence by name', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.resolveUserIdByName).mockResolvedValue('U123');
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue({
        presence: 'away',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--name',
        '@alice',
      ]);

      expect(mockSlackClient.resolveUserIdByName).toHaveBeenCalledWith('@alice');
      expect(mockSlackClient.getUserPresence).toHaveBeenCalledWith('U123');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should display user presence in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const presenceResult = { presence: 'active' };
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue(presenceResult);

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'U123',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(presenceResult, null, 2));
    });

    it('should display user presence in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue({
        presence: 'active',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'U123',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('active'));
    });

    it('should display away presence in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue({
        presence: 'away',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'U123',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserPresence).mockRejectedValue(
        new Error('user_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'UINVALID',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.getUserPresence).mockResolvedValue({
        presence: 'active',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'users',
        'presence',
        '--id',
        'U123',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'users', 'list']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
