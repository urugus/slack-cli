import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BookmarkFormatterOptions,
  createBookmarkFormatter,
} from '../../../src/utils/formatters/bookmark-formatters';

describe('bookmark formatters', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleItems: BookmarkFormatterOptions = {
    items: [
      {
        type: 'message',
        channel: 'C1234567890',
        message: {
          text: 'Hello, world!',
          ts: '1234567890.123456',
        },
        date_create: 1709290800,
      },
      {
        type: 'message',
        channel: 'C0987654321',
        message: {
          text: 'Important meeting notes from today',
          ts: '1234567891.654321',
        },
        date_create: 1709294400,
      },
    ],
  };

  describe('table formatter', () => {
    it('should format bookmarks as table', () => {
      const formatter = createBookmarkFormatter('table');
      formatter.format(sampleItems);

      expect(logSpy).toHaveBeenCalled();
      // Check header is output
      const firstCall = logSpy.mock.calls[0][0];
      expect(firstCall).toContain('Channel');
      expect(firstCall).toContain('Timestamp');
      expect(firstCall).toContain('Text');
      expect(firstCall).toContain('Saved At');
    });

    it('should display message text truncated for long messages', () => {
      const formatter = createBookmarkFormatter('table');
      formatter.format({
        items: [
          {
            type: 'message',
            channel: 'C1234567890',
            message: {
              text: 'A'.repeat(100),
              ts: '1234567890.123456',
            },
            date_create: 1709290800,
          },
        ],
      });

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('simple formatter', () => {
    it('should format bookmarks in simple format', () => {
      const formatter = createBookmarkFormatter('simple');
      formatter.format(sampleItems);

      expect(logSpy).toHaveBeenCalledTimes(2);
      const firstCall = logSpy.mock.calls[0][0];
      expect(firstCall).toContain('C1234567890');
      expect(firstCall).toContain('1234567890.123456');
      expect(firstCall).toContain('Hello, world!');
    });
  });

  describe('json formatter', () => {
    it('should format bookmarks as JSON', () => {
      const formatter = createBookmarkFormatter('json');
      formatter.format(sampleItems);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(2);
      expect(output[0].channel).toBe('C1234567890');
      expect(output[0].timestamp).toBe('1234567890.123456');
      expect(output[0].text).toBe('Hello, world!');
      expect(output[0].type).toBe('message');
    });

    it('should include date_create in JSON output', () => {
      const formatter = createBookmarkFormatter('json');
      formatter.format(sampleItems);

      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output[0].date_create).toBe(1709290800);
      expect(output[0]).toHaveProperty('saved_at');
    });
  });

  describe('factory', () => {
    it('should default to table format for unknown format', () => {
      const formatter = createBookmarkFormatter('unknown');
      formatter.format(sampleItems);

      // Should not throw and should produce table output
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
