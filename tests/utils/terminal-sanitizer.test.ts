import { describe, expect, it } from 'vitest';
import { sanitizeTerminalData, sanitizeTerminalText } from '../../src/utils/terminal-sanitizer';

describe('terminal-sanitizer', () => {
  it('removes ANSI escape sequences and control characters', () => {
    const input = '\u001b[31mhello\u001b[0m\u0007';
    expect(sanitizeTerminalText(input)).toBe('hello');
  });

  it('keeps tab and newline for readability while removing carriage returns', () => {
    const input = 'line1\nline2\tvalue\r\n';
    expect(sanitizeTerminalText(input)).toBe('line1\nline2\tvalue\n');
  });

  it('sanitizes nested arrays and objects recursively', () => {
    const input = {
      message: '\u001b]8;;https://example.com\u0007click\u001b]8;;\u0007',
      items: [{ text: '\u001b[31mwarning\u001b[0m' }, 'safe'],
      count: 2,
    };

    expect(sanitizeTerminalData(input)).toEqual({
      message: 'click',
      items: [{ text: 'warning' }, 'safe'],
      count: 2,
    });
  });

  it('preserves non-plain objects', () => {
    const date = new Date('2026-03-06T00:00:00.000Z');

    expect(sanitizeTerminalData({ createdAt: date })).toEqual({ createdAt: date });
  });
});
