import { describe, expect, it, vi } from 'vitest';
import { parseScheduledTimestamp, resolvePostAt } from '../../src/utils/schedule-utils';
import { optionValidators } from '../../src/utils/validators';

describe('schedule utils', () => {
  describe('parseScheduledTimestamp', () => {
    it('parses unix timestamp seconds', () => {
      expect(parseScheduledTimestamp('1770855000')).toBe(1770855000);
    });

    it('parses ISO date string', () => {
      expect(parseScheduledTimestamp('2026-02-12T00:10:00Z')).toBe(1770855000);
    });

    it('returns null for invalid input', () => {
      expect(parseScheduledTimestamp('invalid')).toBeNull();
    });
  });

  describe('resolvePostAt', () => {
    it('returns parsed timestamp for --at', () => {
      expect(resolvePostAt('1770855000', undefined)).toBe(1770855000);
    });

    it('returns now + minutes for --after', () => {
      expect(resolvePostAt(undefined, '10', Date.parse('2026-02-12T00:00:00Z'))).toBe(1770855000);
    });

    it('returns null when invalid --after is provided', () => {
      expect(resolvePostAt(undefined, '0')).toBeNull();
    });
  });

  describe('optionValidators.scheduleTiming', () => {
    it('rejects both --at and --after', () => {
      expect(optionValidators.scheduleTiming({ at: '1770855000', after: '10' })).toBe(
        'Cannot use both --at and --after'
      );
    });

    it('rejects past --at timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-12T00:00:00Z'));

      expect(optionValidators.scheduleTiming({ at: '1770854300' })).toBe(
        'Schedule time must be in the future'
      );

      vi.useRealTimers();
    });
  });
});
