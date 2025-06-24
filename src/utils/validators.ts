import { Command } from 'commander';
import { ERROR_MESSAGES } from './constants';

/**
 * Common validation functions for CLI commands
 */

export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean | string;
  errorMessage?: string;
}

export interface ValidationOptions {
  required?: boolean;
  rules?: ValidationRule[];
}

/**
 * Validates that a value exists (not undefined, null, or empty string)
 */
export function validateRequired(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`;
  }
  return null;
}

/**
 * Validates mutually exclusive options
 */
export function validateMutuallyExclusive(
  options: Record<string, unknown>,
  fields: string[],
  errorMessage?: string
): string | null {
  const presentFields = fields.filter((field) => options[field] !== undefined);
  if (presentFields.length > 1) {
    return errorMessage || `Cannot use both ${presentFields.join(' and ')}`;
  }
  if (presentFields.length === 0) {
    return errorMessage || `Must specify one of: ${fields.join(', ')}`;
  }
  return null;
}

/**
 * Validates string format using regex
 */
export function validateFormat(
  value: string,
  pattern: RegExp,
  errorMessage: string
): string | null {
  if (!pattern.test(value)) {
    return errorMessage;
  }
  return null;
}

/**
 * Validates numeric range
 */
export function validateRange(
  value: number,
  min?: number,
  max?: number,
  fieldName = 'Value'
): string | null {
  if (min !== undefined && value < min) {
    return `${fieldName} must be at least ${min}`;
  }
  if (max !== undefined && value > max) {
    return `${fieldName} must be at most ${max}`;
  }
  return null;
}

/**
 * Validates date format
 */
export function validateDateFormat(dateString: string): string | null {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Invalid date format';
  }
  return null;
}

/**
 * Common format validators
 */
export const formatValidators = {
  /**
   * Validates Slack thread timestamp format (1234567890.123456)
   */
  threadTimestamp: (value: string): string | null => {
    const pattern = /^\d{10}\.\d{6}$/;
    return validateFormat(value, pattern, ERROR_MESSAGES.INVALID_THREAD_TIMESTAMP);
  },

  /**
   * Validates Slack channel ID format (C1234567890, D1234567890, G1234567890)
   */
  channelId: (value: string): string | null => {
    const pattern = /^[CDG][A-Z0-9]{10,}$/;
    return validateFormat(value, pattern, 'Invalid channel ID format');
  },

  /**
   * Validates output format options
   */
  outputFormat: (value: string): string | null => {
    const validFormats = ['table', 'simple', 'json', 'compact'];
    if (!validFormats.includes(value)) {
      return `Invalid format. Must be one of: ${validFormats.join(', ')}`;
    }
    return null;
  },
};

/**
 * Creates a preAction hook for command validation
 */
export function createValidationHook(
  validations: Array<(options: Record<string, unknown>, command: Command) => string | null>
): (thisCommand: Command) => void {
  return (thisCommand: Command) => {
    const options = thisCommand.opts();

    for (const validation of validations) {
      const error = validation(options, thisCommand);
      if (error) {
        thisCommand.error(`Error: ${error}`);
        break; // Stop processing after first error
      }
    }
  };
}

/**
 * Common command option validators
 */
export const optionValidators = {
  /**
   * Validates message/file options for send command
   */
  messageOrFile: (options: Record<string, unknown>): string | null => {
    if (!options.message && !options.file) {
      return ERROR_MESSAGES.NO_MESSAGE_OR_FILE;
    }
    if (options.message && options.file) {
      return ERROR_MESSAGES.BOTH_MESSAGE_AND_FILE;
    }
    return null;
  },

  /**
   * Validates thread timestamp if provided
   */
  threadTimestamp: (options: Record<string, unknown>): string | null => {
    if (options.thread) {
      return formatValidators.threadTimestamp(options.thread as string);
    }
    return null;
  },

  /**
   * Validates message count for history command
   */
  messageCount: (options: Record<string, unknown>): string | null => {
    if (options.number) {
      const count = parseInt(options.number as string, 10);
      if (isNaN(count)) {
        return 'Message count must be a number';
      }
      return validateRange(count, 1, 1000, 'Message count');
    }
    return null;
  },

  /**
   * Validates date format for history command
   */
  sinceDate: (options: Record<string, unknown>): string | null => {
    if (options.since) {
      const error = validateDateFormat(options.since as string);
      if (error) {
        return 'Invalid date format. Use YYYY-MM-DD HH:MM:SS';
      }
    }
    return null;
  },
};

/**
 * Creates a validated option parser
 */
export function createOptionParser<T>(
  parser: (value: string | undefined, defaultValue: T) => T,
  validator?: (value: T) => string | null
): (value: string | undefined, defaultValue: T) => T {
  return (value: string | undefined, defaultValue: T): T => {
    const parsed = parser(value, defaultValue);
    if (validator) {
      const error = validator(parsed);
      if (error) {
        throw new Error(error);
      }
    }
    return parsed;
  };
}
