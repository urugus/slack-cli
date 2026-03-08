/**
 * Remove control characters to avoid terminal escape injection.
 * Keeps newline and tab for readability.
 */
export function sanitizeTerminalText(value: string): string {
  if (!value) {
    return '';
  }

  const oscSequencePattern = new RegExp('\\u001B\\][^\\u0007\\u001B]*(?:\\u0007|\\u001B\\\\)', 'g');
  const ansiSequencePattern = new RegExp('\\u001B(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])', 'g');
  const withoutAnsiSequences = value
    .replace(oscSequencePattern, '')
    .replace(ansiSequencePattern, '');

  let sanitized = '';

  for (const char of withoutAnsiSequences) {
    const code = char.charCodeAt(0);
    const isAllowedWhitespace = code === 0x09 || code === 0x0a;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeTerminalData<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeTerminalText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTerminalData(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeTerminalData(nestedValue)])
    ) as T;
  }

  return value;
}
