import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProfileConfigManager } from '../../src/utils/profile-config';

vi.mock('fs/promises');
vi.mock('os');

describe('ProfileConfigManager', () => {
  let configManager: ProfileConfigManager;
  const mockConfigPath = '/home/user/.slack-cli/config.json';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    configManager = new ProfileConfigManager();
  });

  describe('setToken', () => {
    it('should set token for default profile when no profile specified', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('test-token');

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('"default"'),
      );
    });

    it('should set token for specified profile', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('test-token', 'production');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.profiles.production.token).toBe('test-token');
    });
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const config = await configManager.getConfig();

      expect(config).toBeNull();
    });

    it('should return config for default profile', async () => {
      const mockStore = {
        profiles: {
          default: {
            token: 'test-token',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const config = await configManager.getConfig();

      expect(config).toEqual(mockStore.profiles.default);
    });

    it('should return config for specified profile', async () => {
      const mockStore = {
        profiles: {
          production: {
            token: 'prod-token',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const config = await configManager.getConfig('production');

      expect(config).toEqual(mockStore.profiles.production);
    });
  });

  describe('listProfiles', () => {
    it('should return empty array when no profiles exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const profiles = await configManager.listProfiles();

      expect(profiles).toEqual([]);
    });

    it('should return all profiles with default flag', async () => {
      const mockStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          production: {
            token: 'prod-token',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const profiles = await configManager.listProfiles();

      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.name === 'default')?.isDefault).toBe(true);
      expect(profiles.find((p) => p.name === 'production')?.isDefault).toBe(false);
    });
  });

  describe('useProfile', () => {
    it('should switch to existing profile', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
          production: { token: 'prod-token', updatedAt: '2024-01-02T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.useProfile('production');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.defaultProfile).toBe('production');
    });

    it('should throw error when profile does not exist', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      await expect(configManager.useProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" does not exist',
      );
    });
  });

  describe('getCurrentProfile', () => {
    it('should return default profile when none set', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const profile = await configManager.getCurrentProfile();

      expect(profile).toBe('default');
    });

    it('should return current profile', async () => {
      const mockStore = {
        profiles: {},
        defaultProfile: 'production',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const profile = await configManager.getCurrentProfile();

      expect(profile).toBe('production');
    });
  });

  describe('clearConfig', () => {
    it('should remove specified profile', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
          production: { token: 'prod-token', updatedAt: '2024-01-02T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.clearConfig('production');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.profiles.production).toBeUndefined();
      expect(savedData.profiles.default).toBeDefined();
    });

    it('should delete config file when last profile removed', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.unlink).mockResolvedValue();

      await configManager.clearConfig('default');

      expect(fs.unlink).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should set new default when current default is removed', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
          production: { token: 'prod-token', updatedAt: '2024-01-02T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.clearConfig('default');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.defaultProfile).toBe('production');
    });
  });

  describe('maskToken', () => {
    it('should mask short tokens completely', () => {
      const masked = configManager.maskToken('short');
      expect(masked).toBe('****');
    });

    it('should mask long tokens showing prefix and suffix', () => {
      const token = 'test-1234567890-abcdefghijklmnop';
      const masked = configManager.maskToken(token);
      expect(masked).toBe('test-****-****-mnop');
    });
  });

  describe('migration', () => {
    it('should migrate old format to new format', async () => {
      const oldConfig = {
        token: 'old-token',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(oldConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      const config = await configManager.getConfig();

      expect(config).toEqual(oldConfig);
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.profiles.default).toEqual(oldConfig);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json');

      await expect(configManager.getConfig()).rejects.toThrow('Invalid config file format');
    });
  });
});