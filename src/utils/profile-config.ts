import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Config, ConfigOptions, ConfigStore, Profile } from '../types/config';
import {
  TOKEN_MASK_LENGTH,
  TOKEN_MIN_LENGTH,
  DEFAULT_PROFILE_NAME,
  ERROR_MESSAGES,
  FILE_PERMISSIONS,
} from './constants';

export class ProfileConfigManager {
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    const configDir = options.configDir || path.join(os.homedir(), '.slack-cli');
    this.configPath = path.join(configDir, 'config.json');
  }

  async setToken(token: string, profile?: string): Promise<void> {
    const store = await this.getConfigStore();
    const profileName = profile || store.defaultProfile || DEFAULT_PROFILE_NAME;
    const config: Config = {
      token,
      updatedAt: new Date().toISOString(),
    };

    store.profiles[profileName] = config;

    // Set as default profile if it's the first one or explicitly setting default
    if (!store.defaultProfile || profileName === DEFAULT_PROFILE_NAME) {
      store.defaultProfile = profileName;
    }

    await this.saveConfigStore(store);
  }

  async getConfig(profile?: string): Promise<Config | null> {
    const store = await this.getConfigStore();
    const profileName = profile || store.defaultProfile || DEFAULT_PROFILE_NAME;

    return store.profiles[profileName] || null;
  }

  async listProfiles(): Promise<Profile[]> {
    const store = await this.getConfigStore();
    const currentProfile = store.defaultProfile || DEFAULT_PROFILE_NAME;

    return Object.entries(store.profiles).map(([name, config]) => ({
      name,
      config,
      isDefault: name === currentProfile,
    }));
  }

  async useProfile(profile: string): Promise<void> {
    const store = await this.getConfigStore();

    if (!store.profiles[profile]) {
      throw new Error(`Profile "${profile}" does not exist`);
    }

    store.defaultProfile = profile;
    await this.saveConfigStore(store);
  }

  async getCurrentProfile(): Promise<string> {
    const store = await this.getConfigStore();
    return store.defaultProfile || DEFAULT_PROFILE_NAME;
  }

  async clearConfig(profile?: string): Promise<void> {
    const store = await this.getConfigStore();
    const profileName = profile || store.defaultProfile || DEFAULT_PROFILE_NAME;

    delete store.profiles[profileName];

    // If we deleted the default profile, set a new default
    if (store.defaultProfile === profileName) {
      const remainingProfiles = Object.keys(store.profiles);
      if (remainingProfiles.length > 0) {
        store.defaultProfile = remainingProfiles[0];
      } else {
        // No profiles left, delete the config file
        try {
          await fs.unlink(this.configPath);
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
            throw error;
          }
        }
        return;
      }
    }

    await this.saveConfigStore(store);
  }

  maskToken(token: string): string {
    if (token.length <= TOKEN_MIN_LENGTH) {
      return '****';
    }

    const prefix = token.substring(0, TOKEN_MASK_LENGTH);
    const suffix = token.substring(token.length - TOKEN_MASK_LENGTH);

    return `${prefix}-****-****-${suffix}`;
  }

  private async getConfigStore(): Promise<ConfigStore> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Handle migration from old format
      if (this.needsMigration(parsed)) {
        return await this.migrateOldConfig(parsed);
      }

      return parsed as ConfigStore;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { profiles: {} };
      }
      if (error instanceof SyntaxError) {
        throw new Error(ERROR_MESSAGES.INVALID_CONFIG_FORMAT);
      }
      throw error;
    }
  }

  private needsMigration(data: unknown): boolean {
    const configData = data as Record<string, unknown>;
    return Boolean(configData.token && !configData.profiles);
  }

  private async migrateOldConfig(oldData: unknown): Promise<ConfigStore> {
    const data = oldData as { token: string; updatedAt: string };
    const oldConfig: Config = {
      token: data.token,
      updatedAt: data.updatedAt,
    };

    const newStore: ConfigStore = {
      profiles: { [DEFAULT_PROFILE_NAME]: oldConfig },
      defaultProfile: DEFAULT_PROFILE_NAME,
    };

    // Save migrated config
    await this.saveConfigStore(newStore);
    return newStore;
  }

  private async saveConfigStore(store: ConfigStore): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    await fs.writeFile(this.configPath, JSON.stringify(store, null, 2));
    await fs.chmod(this.configPath, FILE_PERMISSIONS.CONFIG_FILE);
  }
}

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
