import { describe, expect, it } from 'vitest';
import { sanitizeTerminalData, sanitizeTerminalText } from '../../src/utils/terminal-sanitizer';

describe('terminal-sanitizer', () => {
  it('removes escape and control characters', () => {
    const input = '\u001b[31mhello\u001b[0m\u0007';
    expect(sanitizeTerminalText(input)).toBe('[31mhello[0m');
  });

  it('keeps tab and newline for readability', () => {
    const input = 'line1\nline2\tvalue\r\n';
    expect(sanitizeTerminalText(input)).toBe(input);
  });

  it('sanitizes nested arrays and objects recursively', () => {
    const input = {
      message: '\u001b]8;;https://example.com\u0007click\u001b]8;;\u0007',
      items: [{ text: '\u001b[31mwarning\u001b[0m' }, 'safe'],
      count: 2,
    };

    expect(sanitizeTerminalData(input)).toEqual({
      message: ']8;;https://example.comclick]8;;',
      items: [{ text: '[31mwarning[0m' }, 'safe'],
      count: 2,
    });
  });
});
