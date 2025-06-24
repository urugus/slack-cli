import { describe, it, expect } from 'vitest';
import {
  parseFormat,
  parseLimit,
  parseBoolean,
  parseCount,
  parseProfile,
  parseListOptions,
  OPTION_DEFAULTS,
} from '../../src/utils/option-parsers';

describe('option-parsers', () => {
  describe('parseFormat', () => {
    it('should return default format when undefined', () => {
      expect(parseFormat(undefined)).toBe('table');
    });

    it('should return custom default format when specified', () => {
      expect(parseFormat(undefined, 'json')).toBe('json');
    });

    it('should return provided format', () => {
      expect(parseFormat('compact')).toBe('compact');
    });

    it('should handle empty string', () => {
      expect(parseFormat('')).toBe('table');
    });
  });

  describe('parseLimit', () => {
    it('should return default limit when undefined', () => {
      expect(parseLimit(undefined, 100)).toBe(100);
    });

    it('should parse string limit', () => {
      expect(parseLimit('50', 100)).toBe(50);
    });

    it('should handle invalid number string', () => {
      expect(parseLimit('abc', 100)).toBe(NaN);
    });

    it('should handle empty string', () => {
      expect(parseLimit('', 100)).toBe(100);
    });
  });

  describe('parseBoolean', () => {
    it('should return default value when undefined', () => {
      expect(parseBoolean(undefined)).toBe(false);
      expect(parseBoolean(undefined, true)).toBe(true);
    });

    it('should return provided boolean value', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    it('should handle explicit false over default true', () => {
      expect(parseBoolean(false, true)).toBe(false);
    });
  });

  describe('parseCount', () => {
    it('should return default count when undefined', () => {
      expect(parseCount(undefined, 10)).toBe(10);
    });

    it('should parse string count', () => {
      expect(parseCount('25', 10)).toBe(25);
    });

    it('should handle invalid number string', () => {
      expect(parseCount('invalid', 10)).toBe(10);
    });

    it('should enforce minimum value', () => {
      expect(parseCount('5', 10, 10, 100)).toBe(10);
    });

    it('should enforce maximum value', () => {
      expect(parseCount('150', 10, 10, 100)).toBe(100);
    });

    it('should allow values within range', () => {
      expect(parseCount('50', 10, 10, 100)).toBe(50);
    });

    it('should handle empty string', () => {
      expect(parseCount('', 20)).toBe(20);
    });
  });

  describe('parseProfile', () => {
    it('should return undefined when not provided', () => {
      expect(parseProfile(undefined)).toBeUndefined();
    });

    it('should return provided profile', () => {
      expect(parseProfile('production')).toBe('production');
    });

    it('should handle empty string', () => {
      expect(parseProfile('')).toBe('');
    });
  });

  describe('parseListOptions', () => {
    it('should use all defaults when no options provided', () => {
      const result = parseListOptions({});
      expect(result).toEqual({
        format: 'table',
        limit: 100,
        countOnly: false,
      });
    });

    it('should override specific options', () => {
      const result = parseListOptions({
        format: 'json',
        limit: '50',
        countOnly: true,
      });
      expect(result).toEqual({
        format: 'json',
        limit: 50,
        countOnly: true,
      });
    });

    it('should use custom defaults', () => {
      const result = parseListOptions({}, {
        format: 'compact',
        limit: 200,
        countOnly: true,
      });
      expect(result).toEqual({
        format: 'compact',
        limit: 200,
        countOnly: true,
      });
    });

    it('should override custom defaults with provided options', () => {
      const result = parseListOptions(
        {
          format: 'json',
        },
        {
          format: 'compact',
          limit: 200,
        }
      );
      expect(result).toEqual({
        format: 'json',
        limit: 200,
        countOnly: false,
      });
    });
  });

  describe('OPTION_DEFAULTS', () => {
    it('should have expected default values', () => {
      expect(OPTION_DEFAULTS).toEqual({
        format: 'table',
        limit: 100,
        countOnly: false,
        includeArchived: false,
      });
    });
  });
});