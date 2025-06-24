import { describe, it, expect, vi } from 'vitest';
import {
  validateRequired,
  validateMutuallyExclusive,
  validateFormat,
  validateRange,
  validateDateFormat,
  formatValidators,
  createValidationHook,
  optionValidators,
  createOptionParser,
} from '../../src/utils/validators';
import { Command } from 'commander';

describe('validators', () => {
  describe('validateRequired', () => {
    it('should return null for valid values', () => {
      expect(validateRequired('value', 'field')).toBeNull();
      expect(validateRequired(123, 'field')).toBeNull();
      expect(validateRequired(true, 'field')).toBeNull();
      expect(validateRequired(0, 'field')).toBeNull();
      expect(validateRequired(false, 'field')).toBeNull();
    });

    it('should return error for invalid values', () => {
      expect(validateRequired(undefined, 'field')).toBe('field is required');
      expect(validateRequired(null, 'field')).toBe('field is required');
      expect(validateRequired('', 'field')).toBe('field is required');
    });
  });

  describe('validateMutuallyExclusive', () => {
    it('should return null when exactly one option is present', () => {
      expect(validateMutuallyExclusive({ a: 'value' }, ['a', 'b'])).toBeNull();
      expect(validateMutuallyExclusive({ b: 'value' }, ['a', 'b'])).toBeNull();
    });

    it('should return error when multiple options are present', () => {
      const result = validateMutuallyExclusive({ a: 'value', b: 'value' }, ['a', 'b']);
      expect(result).toBe('Cannot use both a and b');
    });

    it('should return error when no options are present', () => {
      const result = validateMutuallyExclusive({}, ['a', 'b']);
      expect(result).toBe('Must specify one of: a, b');
    });

    it('should use custom error message', () => {
      const result = validateMutuallyExclusive(
        { a: 'value', b: 'value' },
        ['a', 'b'],
        'Custom error'
      );
      expect(result).toBe('Custom error');
    });
  });

  describe('validateFormat', () => {
    it('should return null for valid format', () => {
      expect(validateFormat('123', /^\d+$/, 'error')).toBeNull();
      expect(validateFormat('abc', /^[a-z]+$/, 'error')).toBeNull();
    });

    it('should return error for invalid format', () => {
      expect(validateFormat('abc', /^\d+$/, 'Must be numbers')).toBe('Must be numbers');
      expect(validateFormat('123', /^[a-z]+$/, 'Must be letters')).toBe('Must be letters');
    });
  });

  describe('validateRange', () => {
    it('should return null for values within range', () => {
      expect(validateRange(5, 1, 10)).toBeNull();
      expect(validateRange(1, 1, 10)).toBeNull();
      expect(validateRange(10, 1, 10)).toBeNull();
    });

    it('should return error for values below minimum', () => {
      expect(validateRange(0, 1, 10)).toBe('Value must be at least 1');
      expect(validateRange(-5, 0, 10, 'Count')).toBe('Count must be at least 0');
    });

    it('should return error for values above maximum', () => {
      expect(validateRange(11, 1, 10)).toBe('Value must be at most 10');
      expect(validateRange(1001, 1, 1000, 'Limit')).toBe('Limit must be at most 1000');
    });

    it('should handle only min or only max', () => {
      expect(validateRange(100, 50)).toBeNull();
      expect(validateRange(100, undefined, 200)).toBeNull();
      expect(validateRange(30, 50)).toBe('Value must be at least 50');
      expect(validateRange(300, undefined, 200)).toBe('Value must be at most 200');
    });
  });

  describe('validateDateFormat', () => {
    it('should return null for valid dates', () => {
      expect(validateDateFormat('2024-01-01')).toBeNull();
      expect(validateDateFormat('2024-01-01 10:30:00')).toBeNull();
      expect(validateDateFormat('January 1, 2024')).toBeNull();
    });

    it('should return error for invalid dates', () => {
      expect(validateDateFormat('invalid')).toBe('Invalid date format');
      expect(validateDateFormat('2024-13-01')).toBe('Invalid date format');
      expect(validateDateFormat('')).toBe('Invalid date format');
    });
  });

  describe('formatValidators', () => {
    describe('threadTimestamp', () => {
      it('should validate correct timestamp format', () => {
        expect(formatValidators.threadTimestamp('1234567890.123456')).toBeNull();
        expect(formatValidators.threadTimestamp('9999999999.999999')).toBeNull();
      });

      it('should reject invalid timestamp format', () => {
        expect(formatValidators.threadTimestamp('123')).toBe('Invalid thread timestamp format');
        expect(formatValidators.threadTimestamp('1234567890')).toBe('Invalid thread timestamp format');
        expect(formatValidators.threadTimestamp('1234567890.12')).toBe('Invalid thread timestamp format');
      });
    });

    describe('channelId', () => {
      it('should validate correct channel ID format', () => {
        expect(formatValidators.channelId('C1234567890')).toBeNull();
        expect(formatValidators.channelId('D1234567890')).toBeNull();
        expect(formatValidators.channelId('G1234567890')).toBeNull();
        expect(formatValidators.channelId('C12345678901234')).toBeNull();
      });

      it('should reject invalid channel ID format', () => {
        expect(formatValidators.channelId('A1234567890')).toBe('Invalid channel ID format');
        expect(formatValidators.channelId('C123')).toBe('Invalid channel ID format');
        expect(formatValidators.channelId('general')).toBe('Invalid channel ID format');
      });
    });

    describe('outputFormat', () => {
      it('should validate correct output formats', () => {
        expect(formatValidators.outputFormat('table')).toBeNull();
        expect(formatValidators.outputFormat('simple')).toBeNull();
        expect(formatValidators.outputFormat('json')).toBeNull();
        expect(formatValidators.outputFormat('compact')).toBeNull();
      });

      it('should reject invalid output formats', () => {
        expect(formatValidators.outputFormat('xml')).toBe(
          'Invalid format. Must be one of: table, simple, json, compact'
        );
        expect(formatValidators.outputFormat('csv')).toBe(
          'Invalid format. Must be one of: table, simple, json, compact'
        );
      });
    });
  });

  describe('createValidationHook', () => {
    it('should call command.error when validation fails', () => {
      const mockCommand = {
        opts: vi.fn().mockReturnValue({ test: 'value' }),
        error: vi.fn(),
      } as unknown as Command;

      const validation = vi.fn().mockReturnValue('Validation error');
      const hook = createValidationHook([validation]);

      hook(mockCommand);

      expect(mockCommand.opts).toHaveBeenCalled();
      expect(validation).toHaveBeenCalledWith({ test: 'value' }, mockCommand);
      expect(mockCommand.error).toHaveBeenCalledWith('Error: Validation error');
    });

    it('should not call command.error when all validations pass', () => {
      const mockCommand = {
        opts: vi.fn().mockReturnValue({ test: 'value' }),
        error: vi.fn(),
      } as unknown as Command;

      const validation1 = vi.fn().mockReturnValue(null);
      const validation2 = vi.fn().mockReturnValue(null);
      const hook = createValidationHook([validation1, validation2]);

      hook(mockCommand);

      expect(validation1).toHaveBeenCalled();
      expect(validation2).toHaveBeenCalled();
      expect(mockCommand.error).not.toHaveBeenCalled();
    });

    it('should stop at first validation error', () => {
      const mockCommand = {
        opts: vi.fn().mockReturnValue({ test: 'value' }),
        error: vi.fn(),
      } as unknown as Command;

      const validation1 = vi.fn().mockReturnValue('First error');
      const validation2 = vi.fn().mockReturnValue('Second error');
      const hook = createValidationHook([validation1, validation2]);

      hook(mockCommand);

      expect(validation1).toHaveBeenCalled();
      expect(validation2).not.toHaveBeenCalled();
      expect(mockCommand.error).toHaveBeenCalledWith('Error: First error');
    });
  });

  describe('optionValidators', () => {
    describe('messageOrFile', () => {
      it('should pass when message is provided', () => {
        expect(optionValidators.messageOrFile({ message: 'text' })).toBeNull();
      });

      it('should pass when file is provided', () => {
        expect(optionValidators.messageOrFile({ file: 'path.txt' })).toBeNull();
      });

      it('should fail when neither is provided', () => {
        expect(optionValidators.messageOrFile({})).toBe(
          'You must specify either --message or --file'
        );
      });

      it('should fail when both are provided', () => {
        expect(optionValidators.messageOrFile({ message: 'text', file: 'path.txt' })).toBe(
          'Cannot use both --message and --file'
        );
      });
    });

    describe('threadTimestamp', () => {
      it('should pass when no thread is provided', () => {
        expect(optionValidators.threadTimestamp({})).toBeNull();
      });

      it('should validate thread format when provided', () => {
        expect(optionValidators.threadTimestamp({ thread: '1234567890.123456' })).toBeNull();
        expect(optionValidators.threadTimestamp({ thread: 'invalid' })).toBe(
          'Invalid thread timestamp format'
        );
      });
    });

    describe('messageCount', () => {
      it('should pass when no number is provided', () => {
        expect(optionValidators.messageCount({})).toBeNull();
      });

      it('should validate number range when provided', () => {
        expect(optionValidators.messageCount({ number: '50' })).toBeNull();
        expect(optionValidators.messageCount({ number: '0' })).toBe(
          'Message count must be at least 1'
        );
        expect(optionValidators.messageCount({ number: '1001' })).toBe(
          'Message count must be at most 1000'
        );
        expect(optionValidators.messageCount({ number: 'abc' })).toBe(
          'Message count must be a number'
        );
      });
    });

    describe('sinceDate', () => {
      it('should pass when no date is provided', () => {
        expect(optionValidators.sinceDate({})).toBeNull();
      });

      it('should validate date format when provided', () => {
        expect(optionValidators.sinceDate({ since: '2024-01-01' })).toBeNull();
        expect(optionValidators.sinceDate({ since: 'invalid' })).toBe('Invalid date format. Use YYYY-MM-DD HH:MM:SS');
      });
    });
  });

  describe('createOptionParser', () => {
    it('should parse value and return it when validation passes', () => {
      const parser = vi.fn().mockReturnValue(50);
      const validator = vi.fn().mockReturnValue(null);
      const optionParser = createOptionParser(parser, validator);

      const result = optionParser('50', 100);

      expect(parser).toHaveBeenCalledWith('50', 100);
      expect(validator).toHaveBeenCalledWith(50);
      expect(result).toBe(50);
    });

    it('should throw error when validation fails', () => {
      const parser = vi.fn().mockReturnValue(50);
      const validator = vi.fn().mockReturnValue('Validation failed');
      const optionParser = createOptionParser(parser, validator);

      expect(() => optionParser('50', 100)).toThrow('Validation failed');
    });

    it('should work without validator', () => {
      const parser = vi.fn().mockReturnValue(50);
      const optionParser = createOptionParser(parser);

      const result = optionParser('50', 100);

      expect(parser).toHaveBeenCalledWith('50', 100);
      expect(result).toBe(50);
    });
  });
});