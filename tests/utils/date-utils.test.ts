import { describe, it, expect } from 'vitest';
import { formatUnixTimestamp, formatSlackTimestamp } from '../../src/utils/date-utils';

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
});