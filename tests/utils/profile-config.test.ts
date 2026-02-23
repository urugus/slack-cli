import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { TokenCryptoService } from '../../src/utils/token-crypto-service';
import { ConfigurationError } from '../../src/utils/errors';

vi.mock('fs/promises');
vi.mock('os');

describe('ProfileConfigManager', () => {
  let configManager: ProfileConfigManager;
  const mockConfigPath = '/home/user/.slack-cli/config.json';
  const cryptoService = new TokenCryptoService();

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

    it('should save token to current default profile when no profile specified', async () => {
      const encryptedPersonalToken = cryptoService.encrypt('personal-token');
      const existingStore = {
        profiles: {
          personal: {
            token: encryptedPersonalToken,
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'personal',
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(existingStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('updated-token-123');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      // Token should be encrypted on disk
      expect(cryptoService.isEncrypted(writtenData.profiles.personal.token)).toBe(true);
      expect(cryptoService.decrypt(writtenData.profiles.personal.token)).toBe('updated-token-123');
      expect(writtenData.defaultProfile).toBe('personal');
    });

    it('should set token for specified profile', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('test-token', 'production');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.profiles.production).toBeDefined();
    });

    it('should preserve existing profiles when adding new one', async () => {
      const encryptedPersonalToken = cryptoService.encrypt('personal-token');
      const existingStore = {
        profiles: {
          personal: {
            token: encryptedPersonalToken,
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'personal',
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(existingStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('work-token-123', 'work');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.profiles.personal).toBeDefined();
      expect(writtenData.profiles.work).toBeDefined();
      expect(cryptoService.decrypt(writtenData.profiles.work.token)).toBe('work-token-123');
      expect(writtenData.defaultProfile).toBe('personal');
    });

    it('should encrypt token before saving to disk', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('xoxb-plaintext-token-value', 'default');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      const storedToken = savedData.profiles.default.token;

      // Token on disk must NOT be plaintext
      expect(storedToken).not.toBe('xoxb-plaintext-token-value');
      // Token on disk must be in encrypted format (IV:ciphertext)
      expect(cryptoService.isEncrypted(storedToken)).toBe(true);
      // Decrypting the stored token must return the original
      expect(cryptoService.decrypt(storedToken)).toBe('xoxb-plaintext-token-value');
    });
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const config = await configManager.getConfig();

      expect(config).toBeNull();
    });

    it('should decrypt token when reading encrypted config', async () => {
      const encryptedToken = cryptoService.encrypt('my-secret-token');
      const mockStore = {
        profiles: {
          default: {
            token: encryptedToken,
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const config = await configManager.getConfig();

      expect(config).not.toBeNull();
      expect(config!.token).toBe('my-secret-token');
    });

    it('should return plaintext token as-is for backward compatibility', async () => {
      const mockStore = {
        profiles: {
          default: {
            token: 'xoxb-old-plaintext-token',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      const config = await configManager.getConfig();

      expect(config).not.toBeNull();
      expect(config!.token).toBe('xoxb-old-plaintext-token');
    });

    it('should re-encrypt plaintext token and persist to disk on read', async () => {
      const mockStore = {
        profiles: {
          default: {
            token: 'xoxb-legacy-plaintext-token',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.getConfig();

      // Verify the store was written back with encrypted token
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      const storedToken = savedData.profiles.default.token;

      expect(storedToken).not.toBe('xoxb-legacy-plaintext-token');
      expect(cryptoService.isEncrypted(storedToken)).toBe(true);
      expect(cryptoService.decrypt(storedToken)).toBe('xoxb-legacy-plaintext-token');
    });

    it('should not re-write store when token is already encrypted', async () => {
      const encryptedToken = cryptoService.encrypt('already-encrypted-token');
      const mockStore = {
        profiles: {
          default: {
            token: encryptedToken,
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      await configManager.getConfig();

      // Should NOT write to disk since token was already encrypted
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should return config for specified profile', async () => {
      const encryptedToken = cryptoService.encrypt('prod-token');
      const mockStore = {
        profiles: {
          production: {
            token: encryptedToken,
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      const config = await configManager.getConfig('production');

      expect(config).not.toBeNull();
      expect(config!.token).toBe('prod-token');
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
            token: cryptoService.encrypt('default-token'),
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          production: {
            token: cryptoService.encrypt('prod-token'),
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

    it('should throw ConfigurationError when profile does not exist', async () => {
      const mockStore = {
        profiles: {
          default: { token: 'default-token', updatedAt: '2024-01-01T00:00:00.000Z' },
        },
        defaultProfile: 'default',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockStore));

      try {
        await configManager.useProfile('nonexistent');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).code).toBe('CONFIGURATION_ERROR');
      }
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
    it('should migrate old format to new format and encrypt the token', async () => {
      const oldConfig = {
        token: 'old-token',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(oldConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      const config = await configManager.getConfig();

      // The returned token should be the original plaintext
      expect(config).not.toBeNull();
      expect(config!.token).toBe('old-token');

      // The migrated data on disk should have encrypted token
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.profiles.default).toBeDefined();
      expect(savedData.profiles.default.token).not.toBe('old-token');
      expect(cryptoService.isEncrypted(savedData.profiles.default.token)).toBe(true);
    });
  });

  describe('token encryption roundtrip', () => {
    it('should encrypt on save and decrypt on read', async () => {
      // Save a token
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.chmod).mockResolvedValue();

      await configManager.setToken('xoxb-my-secret-token-12345');

      // Capture what was written to disk
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedDataStr = writeCall[1] as string;

      // Now simulate reading back the same data
      vi.mocked(fs.readFile).mockResolvedValueOnce(savedDataStr);

      const config = await configManager.getConfig();

      // Should get back the original plaintext token
      expect(config).not.toBeNull();
      expect(config!.token).toBe('xoxb-my-secret-token-12345');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json');

      await expect(configManager.getConfig()).rejects.toThrow('Invalid config file format');
    });

    it('should throw ConfigurationError for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json');

      try {
        await configManager.getConfig();
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).code).toBe('CONFIGURATION_ERROR');
      }
    });
  });
});
