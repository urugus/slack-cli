import { Readable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupConfigCommand } from '../../src/commands/config';
import type { Config, Profile } from '../../src/types/config';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../src/utils/constants';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/profile-config');

describe('profile config command', () => {
  let program: ReturnType<typeof createTestProgram>;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: ReturnType<typeof setupMockConsole>;
  const originalEnvToken = process.env.SLACK_CLI_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    });

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupConfigCommand());
  });

  afterEach(() => {
    if (originalEnvToken === undefined) {
      delete process.env.SLACK_CLI_TOKEN;
    } else {
      process.env.SLACK_CLI_TOKEN = originalEnvToken;
    }
    restoreMocks();
  });

  describe('config set with profile', () => {
    it('should set token for specified profile', async () => {
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'slack-cli',
        'config',
        'set',
        '--token',
        'test-token-123',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('test-token-123', 'work');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.TOKEN_SAVED('work'))
      );
    });

    it('should set token for default profile when no profile specified', async () => {
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token', 'test-token-123']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('test-token-123', undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token saved successfully for profile "default"')
      );
    });

    it('should use token from SLACK_CLI_TOKEN when no token option is provided', async () => {
      process.env.SLACK_CLI_TOKEN = 'token-from-env';
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'set']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('token-from-env', undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.TOKEN_SAVED('default'))
      );
    });

    it('should read token from stdin when --token-stdin is provided', async () => {
      const stdinSpy = vi
        .spyOn(process, 'stdin', 'get')
        .mockReturnValue(Readable.from(['token-from-stdin\n']));

      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token-stdin']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('token-from-stdin', undefined);
      stdinSpy.mockRestore();
    });

    it('should show error when interactive prompt is unavailable', async () => {
      delete process.env.SLACK_CLI_TOKEN;

      await program.parseAsync(['node', 'slack-cli', 'config', 'set']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('No token provided.')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config get with profile', () => {
    it('should display config for specified profile', async () => {
      const mockConfig: Config = {
        token: 'test-token-1234567890-abcdefghijklmnop',
        updatedAt: '2025-06-21T10:00:00.000Z',
      };

      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(mockConfigManager.maskToken).mockReturnValue('test-****-****-mnop');

      await program.parseAsync(['node', 'slack-cli', 'config', 'get', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration for profile "work":')
      );
    });
  });

  describe('config profiles', () => {
    it('should list all profiles', async () => {
      const mockProfiles: Profile[] = [
        {
          name: 'default',
          config: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z',
          },
        },
        {
          name: 'work',
          config: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z',
          },
        },
      ];

      vi.mocked(mockConfigManager.listProfiles).mockResolvedValue(mockProfiles);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('work');

      await program.parseAsync(['node', 'slack-cli', 'config', 'profiles']);

      expect(mockConfigManager.listProfiles).toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available profiles:')
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('default'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('* work')); // current profile marked
    });

    it('should show message when no profiles exist', async () => {
      vi.mocked(mockConfigManager.listProfiles).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'config', 'profiles']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('No profiles found'));
    });
  });

  describe('config use', () => {
    it('should switch default profile', async () => {
      vi.mocked(mockConfigManager.useProfile).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'use', 'work']);

      expect(mockConfigManager.useProfile).toHaveBeenCalledWith('work');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Switched to profile "work"')
      );
    });

    it('should show error when profile does not exist', async () => {
      vi.mocked(mockConfigManager.useProfile).mockRejectedValue(
        new Error('Profile "nonexistent" does not exist')
      );

      await program.parseAsync(['node', 'slack-cli', 'config', 'use', 'nonexistent']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config current', () => {
    it('should show current active profile', async () => {
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('work');

      await program.parseAsync(['node', 'slack-cli', 'config', 'current']);

      expect(mockConfigManager.getCurrentProfile).toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current profile: work')
      );
    });
  });

  describe('config clear with profile', () => {
    it('should clear specific profile', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear', '--profile', 'work']);

      expect(mockConfigManager.clearConfig).toHaveBeenCalledWith('work');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Profile "work" cleared successfully')
      );
    });

    it('should clear current profile when no profile specified', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear']);

      expect(mockConfigManager.clearConfig).toHaveBeenCalledWith(undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Profile "default" cleared successfully')
      );
    });
  });
});
