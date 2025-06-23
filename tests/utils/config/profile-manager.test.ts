import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileManager } from '../../../src/utils/config/profile-manager';
import { ConfigFileManager } from '../../../src/utils/config/config-file-manager';
import { TokenCryptoService } from '../../../src/utils/config/token-crypto-service';
import { Config } from '../../../src/types/config';

vi.mock('../../../src/utils/config/config-file-manager');
vi.mock('../../../src/utils/config/token-crypto-service');

describe('ProfileManager', () => {
  let manager: ProfileManager;
  let mockFileManager: ConfigFileManager;
  let mockCryptoService: TokenCryptoService;

  beforeEach(() => {
    mockFileManager = new ConfigFileManager();
    mockCryptoService = new TokenCryptoService();
    manager = new ProfileManager(mockFileManager, mockCryptoService);
    
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should get and decrypt a profile token', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'encrypted-token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockCryptoService.isEncrypted).mockReturnValueOnce(true);
      vi.mocked(mockCryptoService.decrypt).mockReturnValueOnce('decrypted-token');

      const result = await manager.getProfile('test');

      expect(result).toEqual({
        token: 'decrypted-token',
        updatedAt: '2024-01-01'
      });
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith('encrypted-token');
    });

    it('should throw error if profile does not exist', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      await expect(manager.getProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found'
      );
    });

    it('should handle already decrypted tokens', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'plain-token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockCryptoService.isEncrypted).mockReturnValueOnce(false);

      const result = await manager.getProfile('test');

      expect(result).toEqual({
        token: 'plain-token',
        updatedAt: '2024-01-01'
      });
      expect(mockCryptoService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('setProfile', () => {
    it('should set and encrypt a profile token', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      const newProfile: Config = {
        token: 'new-token',
        updatedAt: '2024-01-01'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockCryptoService.encrypt).mockReturnValueOnce('encrypted-new-token');
      vi.mocked(mockFileManager.write).mockResolvedValueOnce(undefined);

      await manager.setProfile('test', newProfile);

      expect(mockCryptoService.encrypt).toHaveBeenCalledWith('new-token');
      expect(mockFileManager.write).toHaveBeenCalledWith({
        profiles: {
          test: { token: 'encrypted-new-token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'default'
      });
    });

    it('should update existing profile', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'old-encrypted', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      };
      const updatedProfile: Config = {
        token: 'updated-token',
        updatedAt: '2024-01-02'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockCryptoService.encrypt).mockReturnValueOnce('encrypted-updated-token');
      vi.mocked(mockFileManager.write).mockResolvedValueOnce(undefined);

      await manager.setProfile('test', updatedProfile);

      expect(mockFileManager.write).toHaveBeenCalledWith({
        profiles: {
          test: { token: 'encrypted-updated-token', updatedAt: '2024-01-02' }
        },
        currentProfile: 'test'
      });
    });
  });

  describe('deleteProfile', () => {
    it('should delete a profile', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'encrypted-token', updatedAt: '2024-01-01' },
          another: { token: 'another-token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockFileManager.write).mockResolvedValueOnce(undefined);

      await manager.deleteProfile('test');

      expect(mockFileManager.write).toHaveBeenCalledWith({
        profiles: {
          another: { token: 'another-token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      });
    });

    it('should throw error if trying to delete non-existent profile', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      await expect(manager.deleteProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found'
      );
    });
  });

  describe('listProfiles', () => {
    it('should list all profile names', async () => {
      const mockConfig = {
        profiles: {
          default: { token: 'token1', updatedAt: '2024-01-01' },
          work: { token: 'token2', updatedAt: '2024-01-01' },
          personal: { token: 'token3', updatedAt: '2024-01-01' }
        },
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      const result = await manager.listProfiles();

      expect(result).toEqual(['default', 'work', 'personal']);
    });

    it('should return empty array if no profiles', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      const result = await manager.listProfiles();

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentProfile', () => {
    it('should return the current profile name', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      const result = await manager.getCurrentProfile();

      expect(result).toBe('test');
    });

    it('should return default if no current profile set', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      const result = await manager.getCurrentProfile();

      expect(result).toBe('default');
    });
  });

  describe('setCurrentProfile', () => {
    it('should set the current profile', async () => {
      const mockConfig = {
        profiles: {
          test: { token: 'token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);
      vi.mocked(mockFileManager.write).mockResolvedValueOnce(undefined);

      await manager.setCurrentProfile('test');

      expect(mockFileManager.write).toHaveBeenCalledWith({
        profiles: {
          test: { token: 'token', updatedAt: '2024-01-01' }
        },
        currentProfile: 'test'
      });
    });

    it('should throw error if profile does not exist', async () => {
      const mockConfig = {
        profiles: {},
        currentProfile: 'default'
      };
      
      vi.mocked(mockFileManager.read).mockResolvedValueOnce(mockConfig);

      await expect(manager.setCurrentProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found'
      );
    });
  });
});