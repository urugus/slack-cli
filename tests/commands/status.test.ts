import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupStatusCommand } from '../../src/commands/status';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));
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

  function tempPath(name: string): string {
    return path.join('/tmp', `slack-cli-${name}-${process.pid}-${Date.now()}`);
  }

  function notRunningError(): Error & { code: string } {
    const error = new Error('not running') as Error & { code: string };
    error.code = 'ESRCH';
    return error;
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

    it('should detect stop-file within five seconds and then clear status', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const stopFile = tempPath('stop');

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

    it('should fall back to --text when text-file is empty', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const textFile = tempPath('status.txt');
      fs.writeFileSync(textFile, '\n');

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
        'Fallback',
        '--text-file',
        textFile,
        '--interval',
        '10',
        '--max-duration',
        '10',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Fallback',
        loadingMessages: [],
      });

      await vi.advanceTimersByTimeAsync(10000);
      await keepAlivePromise;
      fs.unlinkSync(textFile);
    });

    it('should resend immediately when text-file content changes', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const textFile = tempPath('status.txt');
      fs.writeFileSync(textFile, 'Phase 1\n');

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
        'Fallback',
        '--text-file',
        textFile,
        '--interval',
        '30',
        '--max-duration',
        '30',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenLastCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Phase 1',
        loadingMessages: [],
      });

      fs.writeFileSync(textFile, 'Phase 2\n');
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(2);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenLastCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Phase 2',
        loadingMessages: [],
      });

      await vi.advanceTimersByTimeAsync(25000);
      await keepAlivePromise;
      fs.unlinkSync(textFile);
    });

    it('should not resend immediately when text-file content is unchanged', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const textFile = tempPath('status.txt');
      fs.writeFileSync(textFile, 'Working\n');

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
        'Fallback',
        '--text-file',
        textFile,
        '--interval',
        '30',
        '--max-duration',
        '30',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);

      fs.writeFileSync(textFile, 'Working\n');
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(25000);
      await keepAlivePromise;
      fs.unlinkSync(textFile);
    });

    it('should continue with fallback text when text-file disappears', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const textFile = tempPath('status.txt');
      fs.writeFileSync(textFile, 'Phase 1\n');

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
        'Fallback',
        '--text-file',
        textFile,
        '--interval',
        '30',
        '--max-duration',
        '35',
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(1);

      fs.unlinkSync(textFile);
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(2);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenLastCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Fallback',
        loadingMessages: [],
      });

      await vi.advanceTimersByTimeAsync(25000);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenCalledTimes(3);
      expect(mockSlackClient.setAssistantThreadStatus).toHaveBeenLastCalledWith({
        channel: 'general',
        threadTs: '1234567890.123456',
        status: 'Fallback',
        loadingMessages: [],
      });

      await vi.advanceTimersByTimeAsync(5000);
      await keepAlivePromise;
    });

    it('should spawn a detached copy without --detach and write child pid', async () => {
      const pidFile = tempPath('detached.pid');
      const originalArgv = process.argv;
      const unref = vi.fn();
      vi.mocked(spawn).mockReturnValue({
        pid: 4321,
        unref,
      } as ReturnType<typeof spawn>);
      process.argv = [
        'node',
        '/repo/dist/index.js',
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
        '--detach',
        '--pid-file',
        pidFile,
      ];

      try {
        await program.parseAsync(process.argv);
      } finally {
        process.argv = originalArgv;
      }

      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        [
          '/repo/dist/index.js',
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
          '--pid-file',
          pidFile,
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      expect(fs.readFileSync(pidFile, 'utf8')).toBe('4321\n');
      expect(unref).toHaveBeenCalled();
      expect(mockSlackClient.setAssistantThreadStatus).not.toHaveBeenCalled();
      fs.unlinkSync(pidFile);
    });

    it('should write and remove pid-file during foreground keep-alive', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const pidFile = tempPath('foreground.pid');

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
        '1',
        '--max-duration',
        '1',
        '--pid-file',
        pidFile,
      ]);

      await vi.advanceTimersByTimeAsync(0);
      expect(fs.readFileSync(pidFile, 'utf8')).toBe(`${process.pid}\n`);

      await vi.advanceTimersByTimeAsync(1000);
      await keepAlivePromise;

      expect(fs.existsSync(pidFile)).toBe(false);
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

  describe('keep-alive --log-file', () => {
    it('should append timestamped start, success, and stop entries to the log file', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const logFile = tempPath('keepalive.log');

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
        '--log-file',
        logFile,
      ]);

      await vi.advanceTimersByTimeAsync(5000);
      await keepAlivePromise;

      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      fs.unlinkSync(logFile);

      for (const line of lines) {
        expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] /);
      }
      expect(lines[0]).toContain(
        'keep-alive started (pid=' +
          `${process.pid}, channel=general, thread=1234567890.123456, interval=5s, max-duration=5s)`
      );
      expect(lines.some((line) => line.includes('setStatus succeeded: "Working"'))).toBe(true);
      expect(lines.at(-1)).toContain('keep-alive stopped (max-duration reached)');
    });

    it('should log setStatus failures with the error message', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus)
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const logFile = tempPath('keepalive-failure.log');

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
        '--log-file',
        logFile,
      ]);

      await vi.advanceTimersByTimeAsync(11000);
      await keepAlivePromise;

      const content = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);

      expect(content).toContain('setStatus failed: timeout');
      expect(content).toContain('setStatus succeeded: "Working"');
    });

    it('should log stop-file detection as the stop reason', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const stopFile = tempPath('log-stop');
      const logFile = tempPath('keepalive-stopfile.log');

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
        '60',
        '--stop-file',
        stopFile,
        '--log-file',
        logFile,
      ]);

      await vi.advanceTimersByTimeAsync(0);
      fs.writeFileSync(stopFile, '');
      await vi.advanceTimersByTimeAsync(5000);
      await keepAlivePromise;
      fs.unlinkSync(stopFile);

      const content = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);

      expect(content).toContain('keep-alive stopped (stop-file detected)');
    });

    it('should log status text changes detected from text-file', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const textFile = tempPath('log-status.txt');
      const logFile = tempPath('keepalive-change.log');
      fs.writeFileSync(textFile, 'Phase 1\n');

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
        'Fallback',
        '--text-file',
        textFile,
        '--interval',
        '30',
        '--max-duration',
        '30',
        '--log-file',
        logFile,
      ]);

      await vi.advanceTimersByTimeAsync(0);
      fs.writeFileSync(textFile, 'Phase 2\n');
      await vi.advanceTimersByTimeAsync(30000);
      await keepAlivePromise;
      fs.unlinkSync(textFile);

      const content = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);

      expect(content).toContain('status text changed: "Phase 1" -> "Phase 2"');
      expect(content).toContain('setStatus succeeded: "Phase 2"');
    });

    it('should pass --log-file through to the detached child and log the spawn', async () => {
      const pidFile = tempPath('detached-log.pid');
      const logFile = tempPath('detached.log');
      const originalArgv = process.argv;
      const unref = vi.fn();
      vi.mocked(spawn).mockReturnValue({
        pid: 4321,
        unref,
      } as ReturnType<typeof spawn>);
      process.argv = [
        'node',
        '/repo/dist/index.js',
        'status',
        'keep-alive',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--text',
        'Working',
        '--detach',
        '--pid-file',
        pidFile,
        '--log-file',
        logFile,
      ];

      try {
        await program.parseAsync(process.argv);
      } finally {
        process.argv = originalArgv;
      }

      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['--log-file', logFile]),
        {
          detached: true,
          stdio: 'ignore',
        }
      );

      const content = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(pidFile);
      fs.unlinkSync(logFile);

      expect(content).toContain('detached keep-alive started (pid=4321)');
    });

    it('should not create a log file when --log-file is omitted', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.setAssistantThreadStatus).mockResolvedValue({ ok: true });
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const logFile = tempPath('never-created.log');

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

      expect(fs.existsSync(logFile)).toBe(false);
    });
  });

  describe('stop subcommand', () => {
    it('should touch stop-file, terminate pid, remove pid-file, and clear status', async () => {
      mockConfiguredClient();
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const stopFile = tempPath('stop');
      const pidFile = tempPath('keepalive.pid');
      fs.writeFileSync(pidFile, '12345\n');
      let terminated = false;
      const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid !== 12345) {
          return true;
        }

        if (signal === 'SIGTERM') {
          terminated = true;
          return true;
        }

        if (signal === 0 && terminated) {
          throw notRunningError();
        }

        return true;
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'stop',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--stop-file',
        stopFile,
        '--pid-file',
        pidFile,
      ]);

      expect(fs.existsSync(stopFile)).toBe(true);
      expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(killSpy).not.toHaveBeenCalledWith(12345, 'SIGKILL');
      expect(fs.existsSync(pidFile)).toBe(false);
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
      fs.unlinkSync(stopFile);
    });

    it('should send SIGKILL after timeout when process is still running', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
      mockConfiguredClient();
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockResolvedValue({ ok: true });
      const pidFile = tempPath('timeout.pid');
      fs.writeFileSync(pidFile, '23456\n');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const stopPromise = program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'stop',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--pid-file',
        pidFile,
        '--timeout',
        '1',
      ]);

      await vi.advanceTimersByTimeAsync(1000);
      await stopPromise;

      expect(killSpy).toHaveBeenCalledWith(23456, 'SIGTERM');
      expect(killSpy).toHaveBeenCalledWith(23456, 'SIGKILL');
      expect(fs.existsSync(pidFile)).toBe(false);
      expect(mockSlackClient.clearAssistantThreadStatus).toHaveBeenCalledWith(
        'general',
        '1234567890.123456'
      );
    });

    it('should warn and still exit zero when pid-file is missing and clear fails', async () => {
      mockConfiguredClient();
      vi.mocked(mockSlackClient.clearAssistantThreadStatus).mockRejectedValue(
        new Error('clear failed')
      );
      const pidFile = tempPath('missing.pid');

      await program.parseAsync([
        'node',
        'slack-cli',
        'status',
        'stop',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--pid-file',
        pidFile,
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning:'),
        expect.stringContaining('Failed to read pid-file')
      );
      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning:'),
        expect.stringContaining('Failed to clear status')
      );
      expect(mockConsole.exitSpy).not.toHaveBeenCalled();
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

    it('should require pid-file when keep-alive is detached', async () => {
      const statusCommand = setupStatusCommand();
      statusCommand.exitOverride();
      const keepAliveCommand = statusCommand.commands.find(
        (command) => command.name() === 'keep-alive'
      )!;
      keepAliveCommand.exitOverride();

      await expect(
        keepAliveCommand.parseAsync(
          ['-c', 'general', '-t', '1234567890.123456', '--text', 'Working', '--detach'],
          { from: 'user' }
        )
      ).rejects.toThrow('--pid-file is required when --detach is used');
    });
  });
});
