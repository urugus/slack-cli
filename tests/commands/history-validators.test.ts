import { describe, expect, it, vi } from 'vitest';
import {
  prepareSinceTimestamp,
  validateDateFormat,
  validateMessageCount,
} from '../../src/commands/history-validators';

function commandThatThrows() {
  return {
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
}

describe('history validators', () => {
  it('accepts absent and in-range message counts', () => {
    const command = commandThatThrows();

    expect(validateMessageCount(undefined, command as never)).toBeUndefined();
    expect(validateMessageCount('25', command as never)).toBe(25);
    expect(command.error).not.toHaveBeenCalled();
  });

  it('rejects non-numeric and out-of-range message counts', () => {
    const command = commandThatThrows();

    expect(() => validateMessageCount('abc', command as never)).toThrow(
      'Message count must be between'
    );
    expect(() => validateMessageCount('0', command as never)).toThrow(
      'Message count must be between'
    );
    expect(() => validateMessageCount('1001', command as never)).toThrow(
      'Message count must be between'
    );
  });

  it('accepts absent and parseable date values', () => {
    const command = commandThatThrows();

    expect(validateDateFormat(undefined, command as never)).toBeUndefined();
    expect(validateDateFormat('2026-06-14 12:34:56', command as never)).toBe('2026-06-14 12:34:56');
    expect(command.error).not.toHaveBeenCalled();
  });

  it('rejects unparseable date values', () => {
    const command = commandThatThrows();

    expect(() => validateDateFormat('not-a-date', command as never)).toThrow('Invalid date format');
  });

  it('converts a since date into a Slack timestamp string', () => {
    expect(prepareSinceTimestamp(undefined)).toBeUndefined();
    expect(prepareSinceTimestamp('1970-01-01T00:01:05.000Z')).toBe('65');
  });
});
