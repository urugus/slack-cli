import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface ConfigData {
  profiles: Record<string, any>;
  currentProfile: string;
}

export class ConfigFileManager {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.slack-cli', 'config.json');
  }

  async read(): Promise<ConfigData> {
    try {
      await fs.access(this.configPath);
      const data = await fs.readFile(this.configPath, 'utf-8');
      try {
        return JSON.parse(data);
      } catch {
        throw new Error('Invalid configuration file');
      }
    } catch (error: any) {
      if (error.message === 'Invalid configuration file') {
        throw error;
      }
      // File doesn't exist, return default config
      return {
        profiles: {},
        currentProfile: 'default'
      };
    }
  }

  async write(data: ConfigData): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }
}