import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupSendCommand } from '../../src/commands/send';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../src/utils/constants';
import * as fs from 'fs/promises';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');
vi.mock('fs/promises');

describe('send command', () => {
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
    program.addCommand(setupSendCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('send message with -m option', () => {
    it('should send a message to specified channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello, World!']);

      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith('general', 'Hello, World!', undefined);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.MESSAGE_SENT('general'))
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-m',
        'Hello',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('send message with -f option', () => {
    it('should send message from file', async () => {
      const fileContent = 'Message from file\nLine 2';
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-f', 'message.txt']);

      expect(fs.readFile).toHaveBeenCalledWith('message.txt', 'utf-8');
      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith('general', fileContent, undefined);
    });
  });

  describe('send reply to thread', () => {
    it('should send a reply to a thread with --thread option', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-m',
        'Reply to thread',
        '--thread',
        '1719207629.000100',
      ]);

      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith(
        'general',
        'Reply to thread',
        '1719207629.000100'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.MESSAGE_SENT('general'))
      );
    });

    it('should send a reply to a thread with -t option', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-m',
        'Reply to thread',
        '-t',
        '1719207629.000100',
      ]);

      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith(
        'general',
        'Reply to thread',
        '1719207629.000100'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.MESSAGE_SENT('general'))
      );
    });

    it('should validate thread timestamp format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(['-c', 'general', '-m', 'Reply', '-t', 'invalid-timestamp'], {
          from: 'user',
        })
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_THREAD_TIMESTAMP);
    });

    it('should send a reply to a thread with file content', async () => {
      const fileContent = 'Reply from file\nLine 2';
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-f',
        'reply.txt',
        '-t',
        '1719207629.000100',
      ]);

      expect(fs.readFile).toHaveBeenCalledWith('reply.txt', 'utf-8');
      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith(
        'general',
        fileContent,
        '1719207629.000100'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SUCCESS_MESSAGES.MESSAGE_SENT('general'))
      );
    });
  });

  describe('schedule message', () => {
    it('should schedule message with --at', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.scheduleMessage).mockResolvedValue({
        ok: true,
        scheduled_message_id: 'Q1298393284',
        post_at: 2051258400,
      } as any);

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-m',
        'Future message',
        '--at',
        '2035-01-01T10:00:00Z',
      ]);

      expect(mockSlackClient.scheduleMessage).toHaveBeenCalledWith(
        'general',
        'Future message',
        2051258400,
        undefined
      );
      expect(mockSlackClient.sendMessage).not.toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message scheduled to #general')
      );
    });

    it('should schedule message with --after', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-12T00:00:00Z'));

      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.scheduleMessage).mockResolvedValue({
        ok: true,
        scheduled_message_id: 'Q1298393284',
        post_at: 1770868800,
      } as any);

      await program.parseAsync([
        'node',
        'slack-cli',
        'send',
        '-c',
        'general',
        '-m',
        'Future message',
        '--after',
        '10',
      ]);

      expect(mockSlackClient.scheduleMessage).toHaveBeenCalledWith(
        'general',
        'Future message',
        1770855000,
        undefined
      );

      vi.useRealTimers();
    });
  });

  describe('validation', () => {
    it('should fail when no message or file is provided', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(sendCommand.parseAsync(['-c', 'general'], { from: 'user' })).rejects.toThrow(
        `Error: ${ERROR_MESSAGES.NO_MESSAGE_OR_FILE}`
      );
    });

    it('should fail when both message and file are provided', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(['-c', 'general', '-m', 'Hello', '-f', 'file.txt'], {
          from: 'user',
        })
      ).rejects.toThrow(`Error: ${ERROR_MESSAGES.BOTH_MESSAGE_AND_FILE}`);
    });

    it('should fail when both --at and --after are provided', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(
          ['-c', 'general', '-m', 'Hello', '--at', '2030-01-01T10:00:00Z', '--after', '10'],
          {
            from: 'user',
          }
        )
      ).rejects.toThrow(`Error: ${ERROR_MESSAGES.BOTH_SCHEDULE_OPTIONS}`);
    });

    it('should fail with invalid --at', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(['-c', 'general', '-m', 'Hello', '--at', 'invalid-date'], {
          from: 'user',
        })
      ).rejects.toThrow(`Error: ${ERROR_MESSAGES.INVALID_SCHEDULE_AT}`);
    });

    it('should fail with past --at', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(['-c', 'general', '-m', 'Hello', '--at', '1'], {
          from: 'user',
        })
      ).rejects.toThrow(`Error: ${ERROR_MESSAGES.SCHEDULE_TIME_IN_PAST}`);
    });

    it('should fail with invalid --after', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(
        sendCommand.parseAsync(['-c', 'general', '-m', 'Hello', '--after', '0'], {
          from: 'user',
        })
      ).rejects.toThrow(`Error: ${ERROR_MESSAGES.INVALID_SCHEDULE_AFTER}`);
    });

    it('should fail when no channel is provided', async () => {
      const sendCommand = setupSendCommand();
      sendCommand.exitOverride();

      await expect(sendCommand.parseAsync(['-m', 'Hello'], { from: 'user' })).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello']);

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
      vi.mocked(mockSlackClient.sendMessage).mockRejectedValue(new Error('channel_not_found'));

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'nonexistent', '-m', 'Hello']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-f', 'nonexistent.txt']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
