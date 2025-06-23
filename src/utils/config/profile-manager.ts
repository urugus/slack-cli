import { Config } from '../../types/config';
import { ConfigFileManager, ConfigData } from './config-file-manager';
import { TokenCryptoService } from './token-crypto-service';

export class ProfileManager {
  constructor(
    private fileManager: ConfigFileManager,
    private cryptoService: TokenCryptoService
  ) {}

  async getProfile(profileName: string): Promise<Config> {
    const data = await this.fileManager.read();
    const profile = data.profiles[profileName];

    if (!profile) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    // Decrypt token if encrypted
    const token = this.cryptoService.isEncrypted(profile.token)
      ? this.cryptoService.decrypt(profile.token)
      : profile.token;

    return {
      ...profile,
      token,
    };
  }

  async setProfile(profileName: string, config: Config): Promise<void> {
    const data = await this.fileManager.read();

    // Encrypt the token before saving
    const encryptedConfig = {
      ...config,
      token: this.cryptoService.encrypt(config.token),
    };

    data.profiles[profileName] = encryptedConfig;
    await this.fileManager.write(data);
  }

  async deleteProfile(profileName: string): Promise<void> {
    const data = await this.fileManager.read();

    if (!data.profiles[profileName]) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    delete data.profiles[profileName];
    await this.fileManager.write(data);
  }

  async listProfiles(): Promise<string[]> {
    const data = await this.fileManager.read();
    return Object.keys(data.profiles);
  }

  async getCurrentProfile(): Promise<string> {
    const data = await this.fileManager.read();
    return data.currentProfile || 'default';
  }

  async setCurrentProfile(profileName: string): Promise<void> {
    const data = await this.fileManager.read();

    if (!data.profiles[profileName]) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    data.currentProfile = profileName;
    await this.fileManager.write(data);
  }

  async profileExists(profileName: string): Promise<boolean> {
    const data = await this.fileManager.read();
    return profileName in data.profiles;
  }
}
