import * as crypto from 'crypto';

export class TokenCryptoService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly separator = ':';

  private deriveKey(): Buffer {
    // Derive a consistent key from a fixed string
    // In production, this should use a more secure method
    const fixedSalt = 'slack-cli-salt-v1';
    return crypto.pbkdf2Sync('slack-cli-key', fixedSalt, 100000, this.keyLength, 'sha256');
  }

  encrypt(token: string): string {
    try {
      const key = this.deriveKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      return iv.toString('hex') + this.separator + encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt token');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData || !encryptedData.includes(this.separator)) {
        throw new Error('Invalid encrypted data format');
      }

      const parts = encryptedData.split(this.separator);
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      if (iv.length !== this.ivLength) {
        throw new Error('Invalid IV length');
      }

      const key = this.deriveKey();
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt token');
    }
  }

  isEncrypted(value: string): boolean {
    if (!value) return false;
    
    // Check if the value has the expected format
    const parts = value.split(this.separator);
    if (parts.length !== 2) return false;
    
    // Check if the IV part is valid hex and has correct length
    try {
      const ivHex = parts[0];
      if (!/^[0-9a-fA-F]+$/.test(ivHex)) return false;
      if (ivHex.length !== this.ivLength * 2) return false;
      
      return true;
    } catch {
      return false;
    }
  }
}