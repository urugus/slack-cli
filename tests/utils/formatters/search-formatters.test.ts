import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSearchFormatter, SearchFormatterOptions } from '../../../src/utils/formatters/search-formatters';
import { SearchMatch } from '../../../src/utils/slack-api-client';

describe('SearchFormatters', () => {
  let mockConsole: any;

  const createMatches = (): SearchMatch[] => [
    {
      text: 'deploy error occurred in production',
      user: 'U123',
      username: 'john.doe',
      ts: '1609459200.000100',
      channel: { id: 'C123', name: 'general' },
      permalink: 'https://slack.com/archives/C123/p1609459200000100',
    },
    {
      text: 'fixed the deploy error from yesterday',
      user: 'U456',
      username: 'jane.smith',
      ts: '1609459300.000200',
      channel: { id: 'C456', name: 'dev' },
      permalink: 'https://slack.com/archives/C456/p1609459300000200',
    },
  ];

  const createOptions = (overrides?: Partial<SearchFormatterOptions>): SearchFormatterOptions => ({
    query: 'deploy error',
    matches: createMatches(),
    totalCount: 2,
    page: 1,
    pageCount: 1,
    ...overrides,
  });

  beforeEach(() => {
    mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('table formatter', () => {
    it('should display search results header with query and count', () => {
      const formatter = createSearchFormatter('table');
      formatter.format(createOptions());

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('deploy error')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('2')
      );
    });

    it('should display channel name and username for each match', () => {
      const formatter = createSearchFormatter('table');
      formatter.format(createOptions());

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('general')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('john.doe')
      );
    });

    it('should display message text', () => {
      const formatter = createSearchFormatter('table');
      formatter.format(createOptions());

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('deploy error occurred in production')
      );
    });

    it('should show no results message when matches are empty', () => {
      const formatter = createSearchFormatter('table');
      formatter.format(createOptions({ matches: [], totalCount: 0 }));

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('No messages found')
      );
    });

    it('should show page info when multiple pages exist', () => {
      const formatter = createSearchFormatter('table');
      formatter.format(createOptions({ totalCount: 50, page: 2, pageCount: 3 }));

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Page 2/3')
      );
    });
  });

  describe('simple formatter', () => {
    it('should display matches in single-line format', () => {
      const formatter = createSearchFormatter('simple');
      formatter.format(createOptions());

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringMatching(/\[#general\].*john\.doe.*deploy error occurred/)
      );
    });

    it('should show no results message when matches are empty', () => {
      const formatter = createSearchFormatter('simple');
      formatter.format(createOptions({ matches: [], totalCount: 0 }));

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('No messages found')
      );
    });
  });

  describe('json formatter', () => {
    it('should output valid JSON with all fields', () => {
      const formatter = createSearchFormatter('json');
      formatter.format(createOptions());

      const jsonCall = mockConsole.mock.calls.find((call: any[]) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall[0]);
      expect(output.query).toBe('deploy error');
      expect(output.totalCount).toBe(2);
      expect(output.matches).toHaveLength(2);
      expect(output.matches[0].channel).toBe('general');
      expect(output.matches[0].username).toBe('john.doe');
      expect(output.matches[0].permalink).toBe('https://slack.com/archives/C123/p1609459200000100');
    });
  });

  describe('default formatter', () => {
    it('should fallback to table format for unknown format', () => {
      const formatter = createSearchFormatter('unknown');
      formatter.format(createOptions());

      // Should not throw and should output something
      expect(mockConsole).toHaveBeenCalled();
    });
  });
});
