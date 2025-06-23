import type { Config, ConfigOptions, Profile } from '../types/config';
import { TOKEN_MASK_LENGTH, TOKEN_MIN_LENGTH, DEFAULT_PROFILE_NAME } from './constants';
import { ConfigFileManager } from './config/config-file-manager';
import { TokenCryptoService } from './config/token-crypto-service';
import { ProfileManager } from './config/profile-manager';
import * as fs from 'fs/promises';

export class ProfileConfigManager {
  private fileManager: ConfigFileManager;
  private cryptoService: TokenCryptoService;
  private profileManager: ProfileManager;

  constructor(_options: ConfigOptions = {}) {
    // Note: ConfigFileManager currently doesn't support custom configDir
    // This would need to be added if required
    this.fileManager = new ConfigFileManager();
    this.cryptoService = new TokenCryptoService();
    this.profileManager = new ProfileManager(this.fileManager, this.cryptoService);
  }

  async setToken(token: string, profile?: string): Promise<void> {
    const profileName = profile || (await this.profileManager.getCurrentProfile());
    const config: Config = {
      token,
      updatedAt: new Date().toISOString(),
    };

    await this.profileManager.setProfile(profileName, config);

    // Set as default profile if it's the first one or explicitly setting default
    const profiles = await this.profileManager.listProfiles();
    if (profiles.length === 1 || profileName === DEFAULT_PROFILE_NAME) {
      await this.profileManager.setCurrentProfile(profileName);
    }
  }

  async getConfig(profile?: string): Promise<Config | null> {
    const profileName = profile || (await this.profileManager.getCurrentProfile());

    try {
      return await this.profileManager.getProfile(profileName);
    } catch (error) {
      // Return null if profile not found
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async listProfiles(): Promise<Profile[]> {
    const profileNames = await this.profileManager.listProfiles();
    const currentProfile = await this.profileManager.getCurrentProfile();

    const profiles: Profile[] = [];
    for (const name of profileNames) {
      const config = await this.profileManager.getProfile(name);
      profiles.push({
        name,
        config,
        isDefault: name === currentProfile,
      });
    }

    return profiles;
  }

  async useProfile(profile: string): Promise<void> {
    const exists = await this.profileManager.profileExists(profile);
    if (!exists) {
      throw new Error(`Profile "${profile}" does not exist`);
    }

    await this.profileManager.setCurrentProfile(profile);
  }

  async getCurrentProfile(): Promise<string> {
    return await this.profileManager.getCurrentProfile();
  }

  async clearConfig(profile?: string): Promise<void> {
    const profileName = profile || (await this.profileManager.getCurrentProfile());

    try {
      await this.profileManager.deleteProfile(profileName);
    } catch (error) {
      // If profile doesn't exist, do nothing
      if (error instanceof Error && error.message.includes('not found')) {
        return;
      }
      throw error;
    }

    // If we deleted the current profile, set a new default
    const currentProfile = await this.profileManager.getCurrentProfile();
    if (currentProfile === profileName) {
      const remainingProfiles = await this.profileManager.listProfiles();
      if (remainingProfiles.length > 0) {
        await this.profileManager.setCurrentProfile(remainingProfiles[0]);
      } else {
        // No profiles left, delete the config file
        try {
          await fs.unlink(this.fileManager.getConfigPath());
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
            throw error;
          }
        }
      }
    }
  }

  maskToken(token: string): string {
    if (token.length <= TOKEN_MIN_LENGTH) {
      return '****';
    }

    const prefix = token.substring(0, TOKEN_MASK_LENGTH);
    const suffix = token.substring(token.length - TOKEN_MASK_LENGTH);

    return `${prefix}-****-****-${suffix}`;
  }

  // Migration support - to be called separately if needed
  async migrateIfNeeded(): Promise<void> {
    const data = await this.fileManager.read();

    // Check if migration is needed (old format detection)
    const anyData = data as Record<string, unknown>;
    if (anyData.token && !anyData.profiles) {
      // Old format detected, migrate
      const oldConfig: Config = {
        token: anyData.token as string,
        updatedAt: (anyData.updatedAt as string) || new Date().toISOString(),
      };

      // Create new format
      const newData = {
        profiles: { [DEFAULT_PROFILE_NAME]: oldConfig },
        currentProfile: DEFAULT_PROFILE_NAME,
      };

      await this.fileManager.write(newData);

      // Re-encrypt token using new service
      await this.setToken(oldConfig.token, DEFAULT_PROFILE_NAME);
    }
  }
}

// Export a simplified version for backward compatibility
export const profileConfig = {
  getCurrentProfile: (): string => {
    return DEFAULT_PROFILE_NAME;
  },
  getToken: (_profile?: string): string | undefined => {
    // This is a simplified version for testing
    // In real usage, it would need to be async
    return undefined;
  },
};
