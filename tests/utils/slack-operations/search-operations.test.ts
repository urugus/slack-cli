import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchOperations } from '../../../src/utils/slack-operations/search-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      search: {
        messages: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

describe('SearchOperations', () => {
  let searchOps: SearchOperations;
  let mockClient: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    searchOps = new SearchOperations('test-token');
    mockClient = (searchOps as Record<string, unknown>)['client'];
  });

  describe('searchMessages', () => {
    it('should call search.messages with query', async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        query: 'deploy error',
        messages: {
          matches: [
            {
              text: 'deploy error occurred',
              user: 'U123',
              username: 'john.doe',
              ts: '1609459200.000100',
              channel: { id: 'C123', name: 'general' },
              permalink: 'https://slack.com/archives/C123/p1609459200000100',
            },
          ],
          pagination: {
            total_count: 1,
            page: 1,
            page_count: 1,
          },
        },
      });

      const result = await searchOps.searchMessages('deploy error');

      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query: 'deploy error',
        sort: 'score',
        sort_dir: 'desc',
        count: 20,
        page: 1,
      });
      expect(result.query).toBe('deploy error');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].text).toBe('deploy error occurred');
      expect(result.matches[0].channel.name).toBe('general');
      expect(result.totalCount).toBe(1);
    });

    it('should pass sort and pagination options', async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        query: 'test',
        messages: {
          matches: [],
          pagination: { total_count: 0, page: 1, page_count: 0 },
        },
      });

      await searchOps.searchMessages('test', {
        sort: 'timestamp',
        sortDir: 'asc',
        count: 50,
        page: 2,
      });

      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query: 'test',
        sort: 'timestamp',
        sort_dir: 'asc',
        count: 50,
        page: 2,
      });
    });

    it('should return empty matches when no results found', async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        query: 'nonexistent',
        messages: {
          matches: [],
          pagination: { total_count: 0, page: 1, page_count: 0 },
        },
      });

      const result = await searchOps.searchMessages('nonexistent');

      expect(result.matches).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle multiple matches with channel info', async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        query: 'meeting',
        messages: {
          matches: [
            {
              text: 'Meeting at 3pm',
              user: 'U123',
              username: 'alice',
              ts: '1609459200.000100',
              channel: { id: 'C123', name: 'general' },
              permalink: 'https://slack.com/archives/C123/p1609459200000100',
            },
            {
              text: 'Meeting notes attached',
              user: 'U456',
              username: 'bob',
              ts: '1609459300.000200',
              channel: { id: 'C456', name: 'dev' },
              permalink: 'https://slack.com/archives/C456/p1609459300000200',
            },
          ],
          pagination: { total_count: 2, page: 1, page_count: 1 },
        },
      });

      const result = await searchOps.searchMessages('meeting');

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].username).toBe('alice');
      expect(result.matches[1].channel.name).toBe('dev');
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageCount).toBe(1);
    });

    it('should handle missing optional fields gracefully', async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        query: 'test',
        messages: {
          matches: [
            {
              text: 'A message',
              ts: '1609459200.000100',
              channel: { id: 'C123' },
            },
          ],
          pagination: { total_count: 1, page: 1, page_count: 1 },
        },
      });

      const result = await searchOps.searchMessages('test');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].username).toBeUndefined();
      expect(result.matches[0].channel.name).toBeUndefined();
    });
  });
});
