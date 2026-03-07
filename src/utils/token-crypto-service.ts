import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FILE_PERMISSIONS } from './constants';
import { ConfigurationError, ValidationError } from './errors';

export interface TokenCryptoServiceOptions {
  masterKey?: string;
  keyFilePath?: string;
  legacyKeyFilePath?: string;
}

export class TokenCryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly legacyAlgorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 12;
  private readonly legacyIvLength = 16;
  private readonly authTagLength = 16;
  private readonly separator = ':';
  private readonly version = 'v2';
  private readonly masterKeySalt = 'slack-cli-master-key-salt-v2';
  private readonly masterKeyIterations = 100000;
  private readonly keyFilePath?: string;
  private readonly legacyKeyFilePath?: string;
  private readonly injectedMasterKey?: string;
  private cachedMasterKey: Buffer | null = null;

  constructor(options: TokenCryptoServiceOptions = {}) {
    this.injectedMasterKey = options.masterKey;
    this.keyFilePath = options.keyFilePath;
    this.legacyKeyFilePath = options.legacyKeyFilePath;
  }

  private getKeyFilePath(): string {
    return this.keyFilePath || path.join(os.homedir(), '.slack-cli-secrets', 'master.key');
  }

  private getLegacyKeyFilePath(): string {
    return this.legacyKeyFilePath || path.join(os.homedir(), '.slack-cli', 'master.key');
  }

  private deriveLegacyKey(): Buffer {
    // Legacy fallback for decrypting old tokens.
    const fixedSalt = 'slack-cli-salt-v1';
    return crypto.pbkdf2Sync('slack-cli-key', fixedSalt, 100000, this.keyLength, 'sha256');
  }

  private deriveMasterKey(secret: string): Buffer {
    return crypto.pbkdf2Sync(
      secret,
      this.masterKeySalt,
      this.masterKeyIterations,
      this.keyLength,
      'sha256'
    );
  }

  private parseFileKey(fileContents: string): Buffer {
    const keyHex = fileContents.trim();
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      throw new ConfigurationError('Invalid token encryption key format');
    }
    return Buffer.from(keyHex, 'hex');
  }

  private readKeyFromFile(filePath: string): Buffer {
    const keyData = fs.readFileSync(filePath, 'utf-8');
    return this.parseFileKey(keyData);
  }

  private writeKeyFile(keyFilePath: string, keyHex: string): Buffer {
    const keyDir = path.dirname(keyFilePath);
    fs.mkdirSync(keyDir, { recursive: true, mode: FILE_PERMISSIONS.CONFIG_DIR });
    const keyBuffer = Buffer.from(keyHex, 'hex');

    fs.writeFileSync(keyFilePath, `${keyHex}\n`, {
      encoding: 'utf-8',
      mode: FILE_PERMISSIONS.CONFIG_FILE,
      flag: 'wx',
    });

    return keyBuffer;
  }

  private createKeyFile(): Buffer {
    const keyFilePath = this.getKeyFilePath();
    const keyHex = crypto.randomBytes(this.keyLength).toString('hex');
    try {
      return this.writeKeyFile(keyFilePath, keyHex);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        return this.readKeyFromFile(keyFilePath);
      }
      throw new ConfigurationError('Failed to initialize token encryption key');
    }
  }

  private migrateLegacyKeyFile(): Buffer {
    const legacyKeyFilePath = this.getLegacyKeyFilePath();
    const keyFilePath = this.getKeyFilePath();
    const legacyKey = this.readKeyFromFile(legacyKeyFilePath);
    const legacyKeyHex = legacyKey.toString('hex');

    try {
      this.writeKeyFile(keyFilePath, legacyKeyHex);
    } catch (error: unknown) {
      if (!error || typeof error !== 'object' || !('code' in error)) {
        return legacyKey;
      }

      if (error.code !== 'EEXIST' || !fs.existsSync(keyFilePath)) {
        return legacyKey;
      }
    }

    return this.readKeyFromFile(keyFilePath);
  }

  private getMasterKey(): Buffer {
    if (this.cachedMasterKey) {
      return this.cachedMasterKey;
    }

    if (this.injectedMasterKey) {
      this.cachedMasterKey = this.deriveMasterKey(this.injectedMasterKey);
      return this.cachedMasterKey;
    }

    const envMasterKey = process.env.SLACK_CLI_MASTER_KEY?.trim();
    if (envMasterKey) {
      this.cachedMasterKey = this.deriveMasterKey(envMasterKey);
      return this.cachedMasterKey;
    }

    try {
      this.cachedMasterKey = this.readKeyFromFile(this.getKeyFilePath());
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        try {
          this.cachedMasterKey = this.migrateLegacyKeyFile();
        } catch (legacyError: unknown) {
          if (
            legacyError &&
            typeof legacyError === 'object' &&
            'code' in legacyError &&
            legacyError.code === 'ENOENT'
          ) {
            this.cachedMasterKey = this.createKeyFile();
          } else if (legacyError instanceof ConfigurationError) {
            throw legacyError;
          } else {
            throw new ConfigurationError('Failed to migrate token encryption key');
          }
        }
      } else if (error instanceof ConfigurationError) {
        throw error;
      } else {
        throw new ConfigurationError('Failed to load token encryption key');
      }
    }

    return this.cachedMasterKey;
  }

  encrypt(token: string): string {
    try {
      const key = this.getMasterKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return [this.version, iv.toString('hex'), encrypted, authTag.toString('hex')].join(
        this.separator
      );
    } catch {
      throw new ConfigurationError('Failed to encrypt token');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) {
        throw new ValidationError('Invalid encrypted data format');
      }

      if (this.isCurrentFormat(encryptedData)) {
        return this.decryptCurrentFormat(encryptedData);
      }

      if (this.isLegacyEncrypted(encryptedData)) {
        return this.decryptLegacyFormat(encryptedData);
      }

      throw new ValidationError('Invalid encrypted data format');
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ConfigurationError('Failed to decrypt token');
    }
  }

  isEncrypted(value: string): boolean {
    return this.isCurrentFormat(value) || this.isLegacyEncrypted(value);
  }

  isCurrentFormat(value: string): boolean {
    if (!value) {
      return false;
    }

    const parts = value.split(this.separator);
    if (parts.length !== 4 || parts[0] !== this.version) {
      return false;
    }

    const ivHex = parts[1];
    const cipherHex = parts[2];
    const authTagHex = parts[3];

    return (
      /^[0-9a-fA-F]+$/.test(ivHex) &&
      ivHex.length === this.ivLength * 2 &&
      (cipherHex === '' || /^[0-9a-fA-F]+$/.test(cipherHex)) &&
      cipherHex.length % 2 === 0 &&
      /^[0-9a-fA-F]+$/.test(authTagHex) &&
      authTagHex.length === this.authTagLength * 2
    );
  }

  private isLegacyEncrypted(value: string): boolean {
    if (!value) {
      return false;
    }

    const parts = value.split(this.separator);
    if (parts.length !== 2) {
      return false;
    }

    const ivHex = parts[0];
    const cipherHex = parts[1];

    return (
      /^[0-9a-fA-F]+$/.test(ivHex) &&
      ivHex.length === this.legacyIvLength * 2 &&
      /^[0-9a-fA-F]+$/.test(cipherHex) &&
      cipherHex.length > 0 &&
      cipherHex.length % 2 === 0
    );
  }

  private decryptCurrentFormat(encryptedData: string): string {
    if (!this.isCurrentFormat(encryptedData)) {
      throw new ValidationError('Invalid encrypted data format');
    }

    const parts = encryptedData.split(this.separator);
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const authTag = Buffer.from(parts[3], 'hex');

    const key = this.getMasterKey();
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private decryptLegacyFormat(encryptedData: string): string {
    if (!this.isLegacyEncrypted(encryptedData)) {
      throw new ValidationError('Invalid encrypted data format');
    }

    const parts = encryptedData.split(this.separator);
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const key = this.deriveLegacyKey();
    const decipher = crypto.createDecipheriv(this.legacyAlgorithm, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
