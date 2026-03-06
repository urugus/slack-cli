/**
 * Remove control characters to avoid terminal escape injection.
 * Keeps newline, carriage return, and tab for readability.
 */
export function sanitizeTerminalText(value: string): string {
  if (!value) {
    return '';
  }

  let sanitized = '';

  for (const char of value) {
    const code = char.charCodeAt(0);
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    const isAsciiControl = code < 0x20;
    const isDelete = code === 0x7f;
    const isC1Control = code >= 0x80 && code <= 0x9f;

    if ((isAsciiControl || isDelete || isC1Control) && !isAllowedWhitespace) {
      continue;
    }

    sanitized += char;
  }

  return sanitized;
}
