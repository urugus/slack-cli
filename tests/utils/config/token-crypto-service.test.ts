import { describe, it, expect } from 'vitest';
import { TokenCryptoService } from '../../../src/utils/config/token-crypto-service';

describe('TokenCryptoService', () => {
  let service: TokenCryptoService;

  beforeEach(() => {
    service = new TokenCryptoService();
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
  });

  describe('decrypt error handling', () => {
    it('should throw error for invalid encrypted data', () => {
      expect(() => service.decrypt('invalid-data')).toThrow('Failed to decrypt token');
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => service.decrypt('')).toThrow('Failed to decrypt token');
    });

    it('should throw error for malformed encrypted data', () => {
      // Missing IV separator
      expect(() => service.decrypt('aabbccdd')).toThrow('Failed to decrypt token');
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