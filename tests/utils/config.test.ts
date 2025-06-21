import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/utils/config';
import type { Config } from '../../src/types/config';

vi.mock('fs/promises');
vi.mock('os');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, '.slack-cli', 'config.json');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    configManager = new ConfigManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setToken', () => {
    it('should create config directory and save token', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.setToken('test-token-abc');

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(mockConfigPath),
        { recursive: true }
      );
      
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[0]).toBe(mockConfigPath);
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.token).toBe('test-token-abc');
      expect(writtenData.updatedAt).toBeDefined();
      
      expect(fs.chmod).toHaveBeenCalledWith(mockConfigPath, 0o600);
    });

    it('should overwrite existing token', async () => {
      const existingConfig: Config = {
        token: 'test-old-token',
        updatedAt: '2025-01-01T00:00:00.000Z'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.setToken('test-new-token');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.token).toBe('test-new-token');
    });
  });

  describe('getConfig', () => {
    it('should return config when file exists', async () => {
      const mockConfig: Config = {
        token: 'test-token-xyz',
        updatedAt: '2025-06-21T10:00:00.000Z'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.getConfig();

      expect(config).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should return null when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const config = await configManager.getConfig();

      expect(config).toBeNull();
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(configManager.getConfig()).rejects.toThrow('Invalid config file format');
    });
  });

  describe('clearConfig', () => {
    it('should delete config file when it exists', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await configManager.clearConfig();

      expect(fs.unlink).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should not throw when file does not exist', async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(configManager.clearConfig()).resolves.not.toThrow();
    });
  });

  describe('maskToken', () => {
    it('should mask token keeping first 5 and last 4 characters', () => {
      const masked = configManager.maskToken('test-token-1234567890-abcdefghijklmnop');
      
      expect(masked).toBe('test-****-****-mnop');
    });

    it('should return masked string for short tokens', () => {
      const masked = configManager.maskToken('short');
      
      expect(masked).toBe('****');
    });
  });
});