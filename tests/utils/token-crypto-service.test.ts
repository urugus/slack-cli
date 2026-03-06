import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { TokenCryptoService } from '../../src/utils/token-crypto-service';
import { ConfigurationError, ValidationError } from '../../src/utils/errors';

describe('TokenCryptoService', () => {
  let service: TokenCryptoService;
  const originalMasterKey = process.env.SLACK_CLI_MASTER_KEY;

  beforeEach(() => {
    process.env.SLACK_CLI_MASTER_KEY = 'unit-test-master-key';
    service = new TokenCryptoService();
  });

  afterEach(() => {
    if (originalMasterKey === undefined) {
      delete process.env.SLACK_CLI_MASTER_KEY;
    } else {
      process.env.SLACK_CLI_MASTER_KEY = originalMasterKey;
    }
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a token correctly', () => {
      const originalToken = 'test-token-1234567890-abcdefghijklmnop';

      const encrypted = service.encrypt(originalToken);
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('should produce different encrypted values for the same token', () => {
      const token = 'test-token-1234567890-abcdefghijklmnop';

      const encrypted1 = service.encrypt(token);
      const encrypted2 = service.encrypt(token);

      // Different encrypted values due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(token);
      expect(service.decrypt(encrypted2)).toBe(token);
    });

    it('should handle empty token', () => {
      const emptyToken = '';

      const encrypted = service.encrypt(emptyToken);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(emptyToken);
    });

    it('should handle special characters in token', () => {
      const specialToken = 'test-!@#$%^&*()_+-=[]{}|;:,.<>?';

      const encrypted = service.encrypt(specialToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(specialToken);
    });

    it('should handle very long tokens', () => {
      const longToken = 'x'.repeat(1000);

      const encrypted = service.encrypt(longToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('should decrypt legacy AES-256-CBC encrypted token', () => {
      const token = 'legacy-token-value';
      const fixedSalt = 'slack-cli-salt-v1';
      const key = crypto.pbkdf2Sync('slack-cli-key', fixedSalt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const legacyEncryptedToken = `${iv.toString('hex')}:${encrypted}`;

      expect(service.isEncrypted(legacyEncryptedToken)).toBe(true);
      expect(service.isCurrentFormat(legacyEncryptedToken)).toBe(false);
      expect(service.decrypt(legacyEncryptedToken)).toBe(token);
    });
  });

  describe('decrypt error handling', () => {
    it('should throw ValidationError for invalid encrypted data format', () => {
      try {
        service.decrypt('invalid-data');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
        expect((error as ValidationError).message).toBe('Invalid encrypted data format');
      }
    });

    it('should throw ValidationError for empty encrypted data', () => {
      try {
        service.decrypt('');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Invalid encrypted data format');
      }
    });

    it('should throw ValidationError for malformed encrypted data without separator', () => {
      try {
        service.decrypt('aabbccdd');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Invalid encrypted data format');
      }
    });

    it('should throw ValidationError for invalid IV length', () => {
      // Invalid v2 format: IV is too short.
      try {
        service.decrypt('v2:aabb:ccdd:eeff');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Invalid encrypted data format');
      }
    });

    it('should throw ConfigurationError for crypto decryption failure', () => {
      // Valid v2 structure but invalid auth tag/ciphertext combination.
      const fakeIv = 'a'.repeat(24);
      const fakeCipher = '00';
      const fakeTag = 'b'.repeat(32);
      try {
        service.decrypt(`v2:${fakeIv}:${fakeCipher}:${fakeTag}`);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).code).toBe('CONFIGURATION_ERROR');
        expect((error as ConfigurationError).message).toBe('Failed to decrypt token');
      }
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted tokens', () => {
      const token = 'test-token-1234567890';
      const encrypted = service.encrypt(token);

      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain tokens', () => {
      expect(service.isEncrypted('test-token-1234567890')).toBe(false);
      expect(service.isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isEncrypted('')).toBe(false);
    });
  });
});
