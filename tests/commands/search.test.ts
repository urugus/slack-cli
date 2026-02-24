import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupSearchCommand } from '../../src/commands/search';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('search command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    } as any);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    } as any);

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupSearchCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('basic functionality', () => {
    it('should search messages with query', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'deploy error',
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
        totalCount: 1,
        page: 1,
        pageCount: 1,
      });

      await program.parseAsync(['node', 'slack-cli', 'search', '-q', 'deploy error']);

      expect(mockSlackClient.searchMessages).toHaveBeenCalledWith('deploy error', {
        sort: 'score',
        sortDir: 'desc',
        count: 20,
        page: 1,
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('deploy error')
      );
    });

    it('should pass sort options', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'test',
        matches: [],
        totalCount: 0,
        page: 1,
        pageCount: 0,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'search',
        '-q',
        'test',
        '--sort',
        'timestamp',
        '--sort-dir',
        'asc',
      ]);

      expect(mockSlackClient.searchMessages).toHaveBeenCalledWith('test', {
        sort: 'timestamp',
        sortDir: 'asc',
        count: 20,
        page: 1,
      });
    });

    it('should pass count and page options', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'test',
        matches: [],
        totalCount: 0,
        page: 3,
        pageCount: 5,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'search',
        '-q',
        'test',
        '-n',
        '50',
        '--page',
        '3',
      ]);

      expect(mockSlackClient.searchMessages).toHaveBeenCalledWith('test', {
        sort: 'score',
        sortDir: 'desc',
        count: 50,
        page: 3,
      });
    });

    it('should use specific profile when provided', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'test',
        matches: [],
        totalCount: 0,
        page: 1,
        pageCount: 0,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'search',
        '-q',
        'test',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('output formatting', () => {
    it('should display results in JSON format when --format json', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'test',
        matches: [
          {
            text: 'test message',
            user: 'U123',
            username: 'john.doe',
            ts: '1609459200.000100',
            channel: { id: 'C123', name: 'general' },
            permalink: 'https://slack.com/archives/C123/p1609459200000100',
          },
        ],
        totalCount: 1,
        page: 1,
        pageCount: 1,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'search',
        '-q',
        'test',
        '--format',
        'json',
      ]);

      const jsonCall = mockConsole.logSpy.mock.calls.find((call: any[]) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall[0]);
      expect(output.query).toBe('test');
      expect(output.matches).toHaveLength(1);
    });

    it('should display results in simple format when --format simple', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'test',
        matches: [
          {
            text: 'test message',
            user: 'U123',
            username: 'john.doe',
            ts: '1609459200.000100',
            channel: { id: 'C123', name: 'general' },
            permalink: 'https://slack.com/archives/C123/p1609459200000100',
          },
        ],
        totalCount: 1,
        page: 1,
        pageCount: 1,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'search',
        '-q',
        'test',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[#general\].*john\.doe.*test message/)
      );
    });

    it('should show no results message when no matches', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      vi.mocked(mockSlackClient.searchMessages).mockResolvedValue({
        query: 'nonexistent',
        matches: [],
        totalCount: 0,
        page: 1,
        pageCount: 0,
      });

      await program.parseAsync(['node', 'slack-cli', 'search', '-q', 'nonexistent']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No messages found')
      );
    });
  });

  describe('validation', () => {
    it('should show error for invalid sort option', async () => {
      const searchCommand = setupSearchCommand();
      searchCommand.exitOverride();

      await expect(
        searchCommand.parseAsync(['-q', 'test', '--sort', 'invalid'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should show error for invalid sort direction', async () => {
      const searchCommand = setupSearchCommand();
      searchCommand.exitOverride();

      await expect(
        searchCommand.parseAsync(['-q', 'test', '--sort-dir', 'invalid'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should show error for invalid format', async () => {
      const searchCommand = setupSearchCommand();
      searchCommand.exitOverride();

      await expect(
        searchCommand.parseAsync(['-q', 'test', '--format', 'invalid'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should show error for invalid page number', async () => {
      const searchCommand = setupSearchCommand();
      searchCommand.exitOverride();

      await expect(
        searchCommand.parseAsync(['-q', 'test', '--page', '0'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should show error for invalid count', async () => {
      const searchCommand = setupSearchCommand();
      searchCommand.exitOverride();

      await expect(
        searchCommand.parseAsync(['-q', 'test', '-n', '200'], { from: 'user' })
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should show error when no configuration exists', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'search', '-q', 'test']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle Slack API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.searchMessages).mockRejectedValue(
        new Error('not_allowed_token_type')
      );

      await program.parseAsync(['node', 'slack-cli', 'search', '-q', 'test']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
