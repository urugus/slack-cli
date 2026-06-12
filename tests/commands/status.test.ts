import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupStatusCommand } from '../../src/commands/status';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('status command', () => {
  let program: ReturnType<typeof createTestProgram>;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: ReturnType<typeof setupMockConsole>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    });

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    });

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupStatusCommand());
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreMocks();
  });

  function mockConfiguredClient(): void {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
  }

  describe('set subcommand', () => {
    it('should set assistant thread status with loading messages', async () => {
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });

      await program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'set',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--loading-message',
        'Reading context',
        '--loading-message',
        'Calling Slack',
      ]);

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Working',
        loadingMessages: ['Reading context', 'Calling Slack'],
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Status set'));
    });

    it('should report API errors and exit non-zero', async () => {
      mockConfiguredClient();
      const error = new Error('missing_scope');
      Object.assign(error, { data: { error: 'missing_scope', needed: 'chat:write' } });
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockRejectedValue(error);

      await program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'set',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('missing_scope')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('clear subcommand', () => {
    it('should clear assistant thread status', async () => {
      mockConfiguredClient();
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });

      await program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'clear',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Status cleared'));
    });
  });

  describe('keep-alive subcommand', () => {
    it('should refresh until max-duration and then clear status', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });

      const keepAlivePromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--interval',
        '5',
        '--max-duration',
        '12',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5000);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(2000);
      await keepAlivePromise;

      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
    });

    it('should stop when stop-file exists and then clear status', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const stopFile = `/tmp/slack-cli-stop-${process.pid}-${Date.now()}`;

      const keepAlivePromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--interval',
        '5',
        '--max-duration',
        '60',
        '--stop-file',
        stopFile,
      ]);

      await vi.advanceTimersByTimeAsync(0);
      fs.writeFileSync(stopFile, '');
      await vi.advanceTimersByTimeAsync(5000);
      await keepAlivePromise;
      fs.unlinkSync(stopFile);

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
    });

    it('should stop on SIGINT and then clear status', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });

      const keepAlivePromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--interval',
        '80',
        '--max-duration',
        '600',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      process.emit('SIGINT');
      await keepAlivePromise;

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
    });

    it('should warn and continue on transient refresh failures', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus)
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });

      const keepAlivePromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--interval',
        '5',
        '--max-duration',
        '11',
      ]);

      await vi.advanceTimersByTimeAsync(11000);
      await keepAlivePromise;

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(3);
      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning:'),
        'timeout'
      );
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
    });

    it('should ignore clear failures during shutdown', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockRejectedValue(
        new Error('clear failed')
      );

      const keepAlivePromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--interval',
        '5',
        '--max-duration',
        '5',
      ]);

      await vi.advanceTimersByTimeAsync(5000);
      await keepAlivePromise;

      expect(mockConsole.exitSpy).not.toHaveBeenCalled();
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should reject more than 10 loading messages', async () => {
      const statusCommand = setupStatusCommand();
      statusCommand.exitOverride();
      const setCommand = statusCommand.commands.find((command) => command.name() === 'set')!;
      setCommand.exitOverride();
      const args = [
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        ...Array.from({ length: 11 }, (_, index) => ['--loading-message', `msg-${index}`]).flat(),
      ];

      await expect(setCommand.parseAsync(args, { from: 'user' })).rejects.toThrow(
        '--loading-message can be specified at most 10 times'
      );
    });

    it('should reject invalid keep-alive interval', async () => {
      const statusCommand = setupStatusCommand();
      statusCommand.exitOverride();
      const keepAliveCommand = statusCommand.commands.find(
        (command) => command.name() === 'keep-alive'
      )!;
      keepAliveCommand.exitOverride();

      await expect(
        keepAliveCommand.parseAsync(
          ['-c', 'general', '-t', '1234567890.123456', '--text', 'Working', '--interval', '0'],
          { from: 'user' }
        )
      ).rejects.toThrow('--interval must be a positive integer');
    });
  });
});
