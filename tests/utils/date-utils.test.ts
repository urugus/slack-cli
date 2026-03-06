import { describe, expect, it } from 'vitest';
import {
  formatSlackTimestamp,
  formatTimestampFixed,
  formatUnixTimestamp,
} from '../../src/utils/date-utils';

describe('date-utils', () => {
  describe('formatUnixTimestamp', () => {
    it('should format unix timestamp to ISO date string', () => {
      const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
      expect(formatUnixTimestamp(timestamp)).toBe('2022-01-01');
    });

    it('should handle different timestamps correctly', () => {
      const timestamp = 1672531200; // 2023-01-01 00:00:00 UTC
      expect(formatUnixTimestamp(timestamp)).toBe('2023-01-01');
    });
  });

  describe('formatSlackTimestamp', () => {
    it('should format Slack timestamp to locale string', () => {
      const slackTimestamp = '1640995200.000000';
      const result = formatSlackTimestamp(slackTimestamp);
      expect(result).toContain('2022');
    });

    it('should handle timestamps with milliseconds', () => {
      const slackTimestamp = '1640995200.123456';
      const result = formatSlackTimestamp(slackTimestamp);
      expect(result).toContain('2022');
    });
  });

  describe('formatTimestampFixed', () => {
    it('should format Slack timestamp to YYYY-MM-DD HH:MM:SS in UTC', () => {
      const slackTimestamp = '1609459200.000100';
      expect(formatTimestampFixed(slackTimestamp)).toBe('2021-01-01 00:00:00');
    });

    it('should pad single-digit values with zeros', () => {
      const slackTimestamp = '1609502500.000200'; // 2021-01-01 12:01:40 UTC
      expect(formatTimestampFixed(slackTimestamp)).toBe('2021-01-01 12:01:40');
    });
  });
});
