import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Config, ConfigOptions, ConfigStore, Profile } from '../types/config';

export class ProfileConfigManager {
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    const configDir = options.configDir || path.join(os.homedir(), '.slack-cli');
    this.configPath = path.join(configDir, 'config.json');
  }

  async setToken(token: string, profile?: string): Promise<void> {
    const profileName = profile || 'default';
    const config: Config = {
      token,
      updatedAt: new Date().toISOString(),
    };

    const store = await this.getConfigStore();
    store.profiles[profileName] = config;

    // Set as default profile if it's the first one or explicitly setting default
    if (!store.defaultProfile || profileName === 'default') {
      store.defaultProfile = profileName;
    }

    await this.saveConfigStore(store);
  }

  async getConfig(profile?: string): Promise<Config | null> {
    const store = await this.getConfigStore();
    const profileName = profile || store.defaultProfile || 'default';

    return store.profiles[profileName] || null;
  }

  async listProfiles(): Promise<Profile[]> {
    const store = await this.getConfigStore();
    const currentProfile = store.defaultProfile || 'default';

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
    return store.defaultProfile || 'default';
  }

  async clearConfig(profile?: string): Promise<void> {
    const store = await this.getConfigStore();
    const profileName = profile || store.defaultProfile || 'default';

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
    if (token.length <= 9) {
      return '****';
    }

    const prefix = token.substring(0, 4);
    const suffix = token.substring(token.length - 4);

    return `${prefix}-****-****-${suffix}`;
  }

  private async getConfigStore(): Promise<ConfigStore> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Handle migration from old format
      if (parsed.token && !parsed.profiles) {
        const oldConfig: Config = {
          token: parsed.token,
          updatedAt: parsed.updatedAt,
        };

        const newStore: ConfigStore = {
          profiles: { default: oldConfig },
          defaultProfile: 'default',
        };

        // Save migrated config
        await this.saveConfigStore(newStore);
        return newStore;
      }

      return parsed as ConfigStore;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { profiles: {} };
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid config file format');
      }
      throw error;
    }
  }

  private async saveConfigStore(store: ConfigStore): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    await fs.writeFile(this.configPath, JSON.stringify(store, null, 2));
    await fs.chmod(this.configPath, 0o600);
  }
}
