import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ConfigFileManager } from '../../../src/utils/config/config-file-manager';

vi.mock('fs/promises');
vi.mock('os');

describe('ConfigFileManager', () => {
  let manager: ConfigFileManager;
  const mockHomeDir = '/home/user';
  const mockConfigPath = path.join(mockHomeDir, '.slack-cli', 'config.json');

  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    manager = new ConfigFileManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('read', () => {
    it('should read and parse config file when it exists', async () => {
      const mockConfig = {
        profiles: { default: { token: 'encrypted-token' } },
        currentProfile: 'default'
      };
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockConfig));

      const result = await manager.read();

      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should return default config when file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await manager.read();

      expect(result).toEqual({
        profiles: {},
        currentProfile: 'default'
      });
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json');

      await expect(manager.read()).rejects.toThrow('Invalid configuration file');
    });
  });

  describe('write', () => {
    it('should create directory and write config file', async () => {
      const mockConfig = {
        profiles: { default: { token: 'encrypted-token' } },
        currentProfile: 'default'
      };
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

      await manager.write(mockConfig);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(mockConfigPath),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf-8'
      );
    });

    it('should handle write errors', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Write failed'));

      await expect(manager.write(mockConfig)).rejects.toThrow('Write failed');
    });
  });

  describe('exists', () => {
    it('should return true when config file exists', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const result = await manager.exists();

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should return false when config file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await manager.exists();

      expect(result).toBe(false);
    });
  });

  describe('getConfigPath', () => {
    it('should return the correct config path', () => {
      const result = manager.getConfigPath();

      expect(result).toBe(mockConfigPath);
    });
  });
});