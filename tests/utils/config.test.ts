import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import type { Config, ConfigStore } from '../../src/types/config';

vi.mock('fs/promises');
vi.mock('os');

describe('ProfileConfigManager', () => {
  let configManager: ProfileConfigManager;
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, '.slack-cli', 'config.json');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    configManager = new ProfileConfigManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setToken', () => {
    it('should save token to default profile when no profile specified', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      await configManager.setToken('test-token-123');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.default).toBeDefined();
      expect(writtenData.profiles.default.token).toBe('test-token-123');
      expect(writtenData.defaultProfile).toBe('default');
    });

    it('should save token to specified profile', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      await configManager.setToken('work-token-123', 'work');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.work).toBeDefined();
      expect(writtenData.profiles.work.token).toBe('work-token-123');
    });

    it('should preserve existing profiles when adding new one', async () => {
      const existingStore: ConfigStore = {
        profiles: {
          personal: {
            token: 'personal-token',
            updatedAt: '2025-01-01T00:00:00.000Z'
          }
        },
        defaultProfile: 'personal'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingStore));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.setToken('work-token-123', 'work');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.personal).toBeDefined();
      expect(writtenData.profiles.work).toBeDefined();
      expect(writtenData.profiles.work.token).toBe('work-token-123');
      expect(writtenData.defaultProfile).toBe('personal'); // default unchanged
    });
  });

  describe('getConfig', () => {
    it('should return config from default profile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const config = await configManager.getConfig();

      expect(config).toEqual(mockStore.profiles.default);
    });

    it('should return config from specified profile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const config = await configManager.getConfig('work');

      expect(config).toEqual(mockStore.profiles.work);
    });

    it('should return null when profile does not exist', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const config = await configManager.getConfig('nonexistent');

      expect(config).toBeNull();
    });
  });

  describe('listProfiles', () => {
    it('should return all profiles with current profile marked', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          },
          personal: {
            token: 'personal-token',
            updatedAt: '2025-06-21T12:00:00.000Z'
          }
        },
        defaultProfile: 'work'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const profiles = await configManager.listProfiles();

      expect(profiles).toHaveLength(3);
      expect(profiles.find(p => p.name === 'work')?.isDefault).toBe(true);
      expect(profiles.find(p => p.name === 'default')?.isDefault).toBe(false);
    });

    it('should return empty array when no profiles exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const profiles = await configManager.listProfiles();

      expect(profiles).toEqual([]);
    });
  });

  describe('useProfile', () => {
    it('should set default profile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.useProfile('work');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.defaultProfile).toBe('work');
    });

    it('should throw error when profile does not exist', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      await expect(configManager.useProfile('nonexistent')).rejects.toThrow('Profile "nonexistent" does not exist');
    });
  });

  describe('getCurrentProfile', () => {
    it('should return current default profile name', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'work'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const currentProfile = await configManager.getCurrentProfile();

      expect(currentProfile).toBe('work');
    });

    it('should return "default" when no default profile set', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          }
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));

      const currentProfile = await configManager.getCurrentProfile();

      expect(currentProfile).toBe('default');
    });
  });

  describe('clearConfig', () => {
    it('should clear specific profile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'work'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.clearConfig('work');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.work).toBeUndefined();
      expect(writtenData.profiles.default).toBeDefined();
      expect(writtenData.defaultProfile).toBe('default'); // fallback to default
    });

    it('should clear default profile and reset defaultProfile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          },
          work: {
            token: 'work-token',
            updatedAt: '2025-06-21T11:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.clearConfig('default');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.default).toBeUndefined();
      expect(writtenData.profiles.work).toBeDefined();
      expect(writtenData.defaultProfile).toBe('work'); // switch to remaining profile
    });

    it('should delete config file when clearing last profile', async () => {
      const mockStore: ConfigStore = {
        profiles: {
          default: {
            token: 'default-token',
            updatedAt: '2025-06-21T10:00:00.000Z'
          }
        },
        defaultProfile: 'default'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStore));
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await configManager.clearConfig('default');

      expect(fs.unlink).toHaveBeenCalledWith(mockConfigPath);
    });
  });

  describe('migration from old config', () => {
    it('should automatically migrate old single-token config to profile format', async () => {
      const oldConfig = {
        token: 'old-token-123',
        updatedAt: '2025-01-01T00:00:00.000Z'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(oldConfig));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      const config = await configManager.getConfig();

      expect(config).toEqual(oldConfig);
      
      // Verify migration happened
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string) as ConfigStore;
      
      expect(writtenData.profiles.default).toEqual(oldConfig);
      expect(writtenData.defaultProfile).toBe('default');
    });
  });
});