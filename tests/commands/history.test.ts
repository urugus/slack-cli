import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupHistoryCommand } from '../../src/commands/history';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';
import { ERROR_MESSAGES } from '../../src/utils/constants';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('history command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);
    
    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockReturnValue(mockSlackClient);
    
    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupHistoryCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('basic functionality', () => {
    it('should fetch channel history with default options', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });

      const mockMessages = [
        {
          type: 'message',
          text: 'Hello world',
          user: 'U123456',
          ts: '1609459200.000100',
        },
        {
          type: 'message',
          text: 'Another message',
          user: 'U789012',
          ts: '1609459300.000200',
        },
      ];
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: mockMessages,
        users: new Map([
          ['U123456', 'john.doe'],
          ['U789012', 'jane.smith']
        ])
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general']);

      expect(mockSlackClient.getHistory).toHaveBeenCalledWith('general', {
        limit: 10,
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Message History for #general'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('john.doe'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Hello world'));
    });

    it('should fetch history with custom message count', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: [],
        users: new Map()
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general', '-n', '20']);

      expect(mockSlackClient.getHistory).toHaveBeenCalledWith('general', {
        limit: 20,
      });
    });

    it('should fetch history since specific date', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: [],
        users: new Map()
      });

      const testDate = '2024-01-01 00:00:00';
      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general', '--since', testDate]);

      // Calculate expected timestamp based on the actual date parsing behavior
      const expectedTimestamp = Math.floor(Date.parse(testDate) / 1000).toString();
      
      expect(mockSlackClient.getHistory).toHaveBeenCalledWith('general', {
        limit: 10,
        oldest: expectedTimestamp,
      });
    });

    it('should use specific profile when provided', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: [],
        users: new Map()
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('error handling', () => {
    it('should show error when no configuration exists', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show error when profile not found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general', '--profile', 'unknown']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show error for invalid date format', async () => {
      const historyCommand = setupHistoryCommand();
      historyCommand.exitOverride();
      
      await expect(
        historyCommand.parseAsync(['-c', 'general', '--since', 'invalid-date'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should show error for invalid message count', async () => {
      const historyCommand = setupHistoryCommand();
      historyCommand.exitOverride();
      
      await expect(
        historyCommand.parseAsync(['-c', 'general', '-n', '-5'], { from: 'user' })
      ).rejects.toThrow();
    });

    it('should handle Slack API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getHistory).mockRejectedValue(new Error('channel_not_found'));

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'nonexistent']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), expect.any(String));
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show helpful error when channel not found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      
      // Mock getHistory to throw our new helpful error
      vi.mocked(mockSlackClient.getHistory).mockRejectedValue(
        new Error("Channel 'times_sakashi' not found. Make sure you are a member of this channel.")
      );

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'times_sakashi']);

      expect(mockSlackClient.getHistory).toHaveBeenCalledWith('times_sakashi', { limit: 10 });
      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('Make sure you are a member of this channel')
      );
    });

    it('should find private channels with underscore in name', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      
      // Mock the getHistory method to simulate successful channel lookup
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: [],
        users: new Map()
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'times_sakashi']);

      expect(mockSlackClient.getHistory).toHaveBeenCalledWith('times_sakashi', { limit: 10 });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('No messages found'));
    });
  });

  describe('output formatting', () => {
    it('should format messages with user names and timestamps', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });

      const mockMessages = [
        {
          type: 'message',
          text: 'Hello world',
          user: 'U123456',
          ts: '1609459200.000100',
        },
      ];
      
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: mockMessages,
        users: new Map([['U123456', 'john.doe']])
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('john.doe'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Hello world'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Displayed 1 message(s)'));
    });

    it('should handle messages without user info gracefully', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });

      const mockMessages = [
        {
          type: 'message',
          text: 'Bot message',
          bot_id: 'B123456',
          ts: '1609459200.000100',
        },
      ];

      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: mockMessages,
        users: new Map()
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Bot'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Bot message'));
    });

    it('should show message when no messages found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.getHistory).mockResolvedValue({
        messages: [],
        users: new Map()
      });

      await program.parseAsync(['node', 'slack-cli', 'history', '-c', 'general']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('No messages found'));
    });
  });
});