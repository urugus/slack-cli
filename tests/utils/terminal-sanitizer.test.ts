import { describe, expect, it } from 'vitest';
import { sanitizeTerminalText } from '../../src/utils/terminal-sanitizer';

describe('terminal-sanitizer', () => {
  it('removes escape and control characters', () => {
    const input = '\u001b[31mhello\u001b[0m\u0007';
    expect(sanitizeTerminalText(input)).toBe('[31mhello[0m');
  });

  it('keeps tab and newline for readability', () => {
    const input = 'line1\nline2\tvalue\r\n';
    expect(sanitizeTerminalText(input)).toBe(input);
  });
});
