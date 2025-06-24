import { describe, it, expect } from 'vitest';
import { maskToken } from '../../src/utils/token-utils';

describe('token-utils', () => {
  describe('maskToken', () => {
    it('should mask short tokens completely', () => {
      expect(maskToken('short')).toBe('****');
      expect(maskToken('123456789')).toBe('****');
      expect(maskToken('')).toBe('****');
    });

    it('should mask long tokens showing prefix and suffix', () => {
      const token = 'test-1234567890-abcdefghijklmnop';
      expect(maskToken(token)).toBe('test-****-****-mnop');
    });

    it('should handle tokens of exactly minimum length + 1', () => {
      const token = '1234567890'; // 10 characters
      expect(maskToken(token)).toBe('1234-****-****-7890');
    });

    it('should handle various token formats', () => {
      expect(maskToken('test-123456789012345')).toBe('test-****-****-2345');
      expect(maskToken('demo-2-123456789012345')).toBe('demo-****-****-2345');
      expect(maskToken('1234567890123456789012345')).toBe('1234-****-****-2345');
    });

    it('should handle tokens with special characters', () => {
      expect(maskToken('test-token-with-dashes')).toBe('test-****-****-shes');
      expect(maskToken('token_with_underscores')).toBe('toke-****-****-ores');
    });
  });
});