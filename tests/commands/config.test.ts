import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { configCommand } from '../../src/commands/config';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import type { Config, Profile } from '../../src/types/config';

vi.mock('../../src/utils/profile-config');

describe('profile config command', () => {
  let program: Command;
  let mockConfigManager: ProfileConfigManager;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    program = new Command();
    program.exitOverride();
    configCommand(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('config set with profile', () => {
    it('should set token for specified profile', async () => {
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token', 'test-token-123', '--profile', 'work']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('test-token-123', 'work');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token saved successfully for profile "work"'));
    });

    it('should set token for default profile when no profile specified', async () => {
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token', 'test-token-123']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('test-token-123', undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token saved successfully for profile "default"'));
    });
  });

  describe('config get with profile', () => {
    it('should display config for specified profile', async () => {
      const mockConfig: Config = {
        token: 'test-token-1234567890-abcdefghijklmnop',
        updatedAt: '2025-06-21T10:00:00.000Z'
      };

      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(mockConfigManager.maskToken).mockReturnValue('test-****-****-mnop');

      await program.parseAsync(['node', 'slack-cli', 'config', 'get', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration for profile "work":'));
    });
  });

  describe('config profiles', () => {
    it('should list all profiles', async () => {
      const mockProfiles: Profile[] = [
        {
          name: 'default',
          config: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          }
        },
        {
          name: 'work',
          config: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        }
      ];

      vi.mocked(mockConfigManager.listProfiles).mockResolvedValue(mockProfiles);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('work');

      await program.parseAsync(['node', 'slack-cli', 'config', 'profiles']);

      expect(mockConfigManager.listProfiles).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available profiles:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('default'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('* work')); // current profile marked
    });

    it('should show message when no profiles exist', async () => {
      vi.mocked(mockConfigManager.listProfiles).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'config', 'profiles']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No profiles found'));
    });
  });

  describe('config use', () => {
    it('should switch default profile', async () => {
      vi.mocked(mockConfigManager.useProfile).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'use', 'work']);

      expect(mockConfigManager.useProfile).toHaveBeenCalledWith('work');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Switched to profile "work"'));
    });

    it('should show error when profile does not exist', async () => {
      vi.mocked(mockConfigManager.useProfile).mockRejectedValue(new Error('Profile "nonexistent" does not exist'));

      await program.parseAsync(['node', 'slack-cli', 'config', 'use', 'nonexistent']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error switching profile'), expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config current', () => {
    it('should show current active profile', async () => {
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('work');

      await program.parseAsync(['node', 'slack-cli', 'config', 'current']);

      expect(mockConfigManager.getCurrentProfile).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Current profile: work'));
    });
  });

  describe('config clear with profile', () => {
    it('should clear specific profile', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear', '--profile', 'work']);

      expect(mockConfigManager.clearConfig).toHaveBeenCalledWith('work');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Profile "work" cleared successfully'));
    });

    it('should clear current profile when no profile specified', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockResolvedValue(undefined);
      vi.mocked(mockConfigManager.getCurrentProfile).mockResolvedValue('default');

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear']);

      expect(mockConfigManager.clearConfig).toHaveBeenCalledWith(undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Profile "default" cleared successfully'));
    });
  });
});