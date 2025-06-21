import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Config, ConfigOptions } from '../types/config';

export class ConfigManager {
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    const configDir = options.configDir || path.join(os.homedir(), '.slack-cli');
    this.configPath = path.join(configDir, 'config.json');
  }

  async setToken(token: string): Promise<void> {
    const config: Config = {
      token,
      updatedAt: new Date().toISOString(),
    };

    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    await fs.chmod(this.configPath, 0o600);
  }

  async getConfig(): Promise<Config | null> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);

      if (!config.token || !config.updatedAt) {
        throw new Error('Invalid config file format');
      }

      return config as Config;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid config file format');
      }
      throw error;
    }
  }

  async clearConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  maskToken(token: string): string {
    if (token.length <= 9) {
      return '****';
    }

    const prefix = token.substring(0, 4);
    const suffix = token.substring(token.length - 4);

    return `${prefix}-****-****-${suffix}`;
  }
}
