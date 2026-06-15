import chalk from 'chalk';
import { spawn } from 'child_process';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type {
  StatusClearOptions,
  StatusKeepAliveOptions,
  StatusSetOptions,
  StatusStopOptions,
} from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { extractErrorMessage } from '../utils/error-utils';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, formatValidators } from '../utils/validators';

const DEFAULT_KEEP_ALIVE_INTERVAL_SECONDS = 80;
const DEFAULT_KEEP_ALIVE_MAX_DURATION_SECONDS = 600;
const DEFAULT_STOP_TIMEOUT_SECONDS = 5;
const STOP_FILE_POLL_INTERVAL_MS = 5000;
const STOP_PROCESS_POLL_INTERVAL_MS = 100;
const MAX_LOADING_MESSAGES = 10;

type StatusCommandOptions = {
  channel?: string;
  thread?: string;
  text?: string;
  textFile?: string;
  interval?: string;
  maxDuration?: string;
  timeout?: string;
  detach?: boolean;
  pidFile?: string;
  logFile?: string;
  loadingMessage?: string[];
};

function collectLoadingMessage(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function validateStatusBase(options: StatusCommandOptions): string | null {
  if (!options.channel) {
    return '--channel is required';
  }

  if (!options.thread) {
    return '--thread is required';
  }

  return formatValidators.threadTimestamp(options.thread);
}

function validateStatusText(options: StatusCommandOptions): string | null {
  if (options.text === undefined || options.text === '') {
    return '--text is required';
  }

  return null;
}

function validateLoadingMessages(options: StatusCommandOptions): string | null {
  if ((options.loadingMessage?.length ?? 0) > MAX_LOADING_MESSAGES) {
    return '--loading-message can be specified at most 10 times';
  }

  return null;
}

function validatePositiveIntegerOption(
  options: StatusCommandOptions,
  optionName: 'interval' | 'maxDuration' | 'timeout',
  label: string
): string | null {
  const value = options[optionName];
  if (value === undefined) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return `${label} must be a positive integer`;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return `${label} must be a positive integer`;
  }

  return null;
}

function validateDetachOptions(options: StatusCommandOptions): string | null {
  if (options.detach && !options.pidFile) {
    return '--pid-file is required when --detach is used';
  }

  return null;
}

function validateDistinctLifecycleFiles(options: StatusCommandOptions): string | null {
  if (!options.pidFile || !options.logFile) {
    return null;
  }

  if (path.resolve(options.pidFile) === path.resolve(options.logFile)) {
    return '--pid-file and --log-file must be different paths';
  }

  return null;
}

function parsePositiveSeconds(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Number.parseInt(value, 10);
}

function createInterruptibleDelay(
  ms: number,
  isStopped: () => boolean,
  registerWake: (wake: (() => void) | undefined) => void
): Promise<void> {
  if (ms <= 0 || isStopped()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      registerWake(undefined);
      resolve();
    }, ms);

    registerWake(() => {
      clearTimeout(timeout);
      registerWake(undefined);
      resolve();
    });
  });
}

async function createStopFileAwareDelay(
  ms: number,
  isStopped: () => boolean,
  registerWake: (wake: (() => void) | undefined) => void,
  stopFile?: string,
  onPoll?: () => Promise<void>
): Promise<void> {
  const deadline = Date.now() + ms;

  while (!isStopped() && Date.now() < deadline) {
    if (stopFile && fs.existsSync(stopFile)) {
      return;
    }

    await onPoll?.();

    if (isStopped() || (stopFile && fs.existsSync(stopFile))) {
      return;
    }

    await createInterruptibleDelay(
      Math.min(STOP_FILE_POLL_INTERVAL_MS, deadline - Date.now()),
      isStopped,
      registerWake
    );
  }
}

function warn(message: string): void {
  console.error(chalk.yellow('Warning:'), message);
}

type KeepAliveLogger = (message: string) => void;

function createKeepAliveLogger(logFile: string | undefined): KeepAliveLogger {
  if (!logFile) {
    return () => {
      // No-op when --log-file is not specified.
    };
  }

  try {
    const directory = path.dirname(logFile);
    if (directory && directory !== '.') {
      fs.mkdirSync(directory, { recursive: true });
    }
  } catch {
    return () => {
      // Logging is best-effort and must not break keep-alive.
    };
  }

  return (message) => {
    try {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
    } catch {
      // Logging is best-effort and must not break keep-alive.
    }
  };
}

function resolveStatusText(text: string, textFile: string | undefined): string {
  if (!textFile) {
    return text;
  }

  try {
    const content = fs.readFileSync(textFile, 'utf8').trim();
    if (content === '') {
      return text;
    }

    return content.replace(/[\r\n]+/g, '');
  } catch {
    return text;
  }
}

async function clearStatusIgnoringErrors(
  client: Awaited<ReturnType<typeof createSlackClient>>,
  channel: string,
  threadTs: string
): Promise<void> {
  try {
    await client.clearAssistantThreadStatus(channel, threadTs);
  } catch {
    // keep-alive cleanup should not turn an otherwise successful shutdown into a failure.
  }
}

function removeFileIgnoringErrors(filePath: string | undefined): void {
  if (!filePath) {
    return;
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    // Cleanup is best-effort for lifecycle files.
  }
}

function writePidFile(pidFile: string, pid: number): void {
  const directory = path.dirname(pidFile);
  if (directory && directory !== '.') {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(pidFile, `${pid}\n`);
}

function createDetachedArgs(): string[] {
  return process.argv.slice(1).filter((arg) => arg !== '--detach');
}

function runDetachedKeepAlive(options: StatusKeepAliveOptions, log: KeepAliveLogger): void {
  const child = spawn(process.execPath, createDetachedArgs(), {
    detached: true,
    stdio: 'ignore',
  });

  if (child.pid === undefined) {
    throw new Error('Failed to start detached keep-alive process');
  }

  writePidFile(options.pidFile!, child.pid);
  child.unref();
  log(`detached keep-alive started (pid=${child.pid})`);
}

function touchStopFile(stopFile: string): void {
  const directory = path.dirname(stopFile);
  if (directory && directory !== '.') {
    fs.mkdirSync(directory, { recursive: true });
  }

  const handle = fs.openSync(stopFile, 'a');
  fs.closeSync(handle);
  fs.utimesSync(stopFile, new Date(), new Date());
}

function parsePid(pidFile: string): number | undefined {
  const content = fs.readFileSync(pidFile, 'utf8').trim();
  if (!/^\d+$/.test(content)) {
    return undefined;
  }

  const pid = Number.parseInt(content, 10);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return undefined;
  }

  return pid;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return (error as { code?: string }).code === 'EPERM';
    }

    return false;
  }
}

function sendSignal(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    warn(`Failed to send ${signal} to process ${pid}: ${extractErrorMessage(error)}`);
    return false;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(STOP_PROCESS_POLL_INTERVAL_MS, deadline - Date.now()))
    );
  }

  return !isProcessAlive(pid);
}

async function runKeepAlive(options: StatusKeepAliveOptions): Promise<void> {
  const log = createKeepAliveLogger(options.logFile);

  if (options.detach) {
    runDetachedKeepAlive(options, log);
    return;
  }

  const intervalSeconds = parsePositiveSeconds(
    options.interval,
    DEFAULT_KEEP_ALIVE_INTERVAL_SECONDS
  );
  const maxDurationSeconds = parsePositiveSeconds(
    options.maxDuration,
    DEFAULT_KEEP_ALIVE_MAX_DURATION_SECONDS
  );
  const intervalMs = intervalSeconds * 1000;
  const maxDurationMs = maxDurationSeconds * 1000;
  const profile = parseProfile(options.profile);

  log(
    `keep-alive started (pid=${process.pid}, channel=${options.channel}, ` +
      `thread=${options.thread}, interval=${intervalSeconds}s, max-duration=${maxDurationSeconds}s)`
  );

  let client: Awaited<ReturnType<typeof createSlackClient>>;
  try {
    client = await createSlackClient(profile);
  } catch (error) {
    log(`keep-alive startup failed: ${extractErrorMessage(error)}`);
    throw error;
  }

  const startedAt = Date.now();
  let stopRequested = false;
  let wakeDelay: (() => void) | undefined;
  let lastSentStatus: string | undefined;

  const requestStop = () => {
    stopRequested = true;
    wakeDelay?.();
  };

  const setCurrentStatus = async (): Promise<void> => {
    const status = resolveStatusText(options.text, options.textFile);
    try {
      await client.setAssistantThreadStatus({
        channel: options.channel,
        threadTs: options.thread,
        status,
        loadingMessages: options.loadingMessage,
      });
      lastSentStatus = status;
      log(`setStatus succeeded: "${status}"`);
    } catch (error) {
      log(`setStatus failed: ${extractErrorMessage(error)}`);
      throw error;
    }
  };

  const resendIfStatusTextChanged = async (): Promise<void> => {
    const status = resolveStatusText(options.text, options.textFile);
    if (status === lastSentStatus) {
      return;
    }

    log(`status text changed: "${lastSentStatus}" -> "${status}"`);
    try {
      await setCurrentStatus();
    } catch (error) {
      console.error(chalk.yellow('Warning:'), extractErrorMessage(error));
    }
  };

  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);

  let stopReason: string | undefined;

  try {
    if (options.pidFile) {
      writePidFile(options.pidFile, process.pid);
    }

    await setCurrentStatus();

    while (!stopRequested) {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = maxDurationMs - elapsedMs;
      if (remainingMs <= 0) {
        stopReason = 'max-duration reached';
        break;
      }

      await createStopFileAwareDelay(
        Math.min(intervalMs, remainingMs),
        () => stopRequested,
        (wake) => {
          wakeDelay = wake;
        },
        options.stopFile,
        options.textFile ? resendIfStatusTextChanged : undefined
      );

      if (stopRequested) {
        break;
      }

      if (options.stopFile && fs.existsSync(options.stopFile)) {
        stopReason = 'stop-file detected';
        break;
      }

      if (Date.now() - startedAt >= maxDurationMs) {
        stopReason = 'max-duration reached';
        break;
      }

      try {
        await setCurrentStatus();
      } catch (error) {
        console.error(chalk.yellow('Warning:'), extractErrorMessage(error));
      }
    }

    if (stopRequested && stopReason === undefined) {
      stopReason = 'stop signal received';
    }
  } finally {
    process.off('SIGINT', requestStop);
    process.off('SIGTERM', requestStop);
    await clearStatusIgnoringErrors(client, options.channel, options.thread);
    removeFileIgnoringErrors(options.pidFile);
    log(`keep-alive stopped (${stopReason ?? 'error'})`);
  }
}

async function clearStatusWithWarning(options: StatusStopOptions): Promise<void> {
  try {
    const profile = parseProfile(options.profile);
    const client = await createSlackClient(profile);
    await client.clearAssistantThreadStatus(options.channel, options.thread);
  } catch (error) {
    warn(`Failed to clear status: ${extractErrorMessage(error)}`);
  }
}

async function stopProcessFromPidFile(pidFile: string, timeoutMs: number): Promise<void> {
  let pid: number | undefined;

  try {
    pid = parsePid(pidFile);
  } catch (error) {
    warn(`Failed to read pid-file ${pidFile}: ${extractErrorMessage(error)}`);
    removeFileIgnoringErrors(pidFile);
    return;
  }

  if (pid === undefined) {
    warn(`Invalid pid-file ${pidFile}`);
    removeFileIgnoringErrors(pidFile);
    return;
  }

  if (!isProcessAlive(pid)) {
    warn(`Process ${pid} is not running`);
    removeFileIgnoringErrors(pidFile);
    return;
  }

  if (sendSignal(pid, 'SIGTERM')) {
    const exited = await waitForProcessExit(pid, timeoutMs);
    if (!exited && isProcessAlive(pid)) {
      sendSignal(pid, 'SIGKILL');
    }
  }

  removeFileIgnoringErrors(pidFile);
}

async function runStop(options: StatusStopOptions): Promise<void> {
  if (options.stopFile) {
    try {
      touchStopFile(options.stopFile);
    } catch (error) {
      warn(`Failed to create stop-file ${options.stopFile}: ${extractErrorMessage(error)}`);
    }
  }

  if (options.pidFile) {
    const timeoutSeconds = parsePositiveSeconds(options.timeout, DEFAULT_STOP_TIMEOUT_SECONDS);
    await stopProcessFromPidFile(options.pidFile, timeoutSeconds * 1000);
  }

  await clearStatusWithWarning(options);
}

export function setupStatusCommand(): Command {
  const statusCommand = new Command('status').description('Manage Slack assistant thread status');

  const setCommand = new Command('set')
    .description('Set assistant status for a thread')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-t, --thread <thread>', 'Thread parent timestamp')
    .requiredOption('--text <text>', 'Status text')
    .option(
      '--loading-message <message>',
      'Loading message shown by Slack; can be specified up to 10 times',
      collectLoadingMessage,
      []
    )
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([validateStatusBase, validateStatusText, validateLoadingMessages])
    )
    .action(
      wrapCommand(async (options: StatusSetOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        await client.setAssistantThreadStatus({
          channel: options.channel,
          threadTs: options.thread,
          status: options.text,
          loadingMessages: options.loadingMessage,
        });
        console.log(
          chalk.green(`✓ Status set for thread ${options.thread} in #${options.channel}`)
        );
      })
    );

  const clearCommand = new Command('clear')
    .description('Clear assistant status for a thread')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-t, --thread <thread>', 'Thread parent timestamp')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([validateStatusBase]))
    .action(
      wrapCommand(async (options: StatusClearOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);
        await client.clearAssistantThreadStatus(options.channel, options.thread);
        console.log(
          chalk.green(`✓ Status cleared for thread ${options.thread} in #${options.channel}`)
        );
      })
    );

  const keepAliveCommand = new Command('keep-alive')
    .description('Refresh assistant status until max duration, stop file, or signal')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-t, --thread <thread>', 'Thread parent timestamp')
    .requiredOption('--text <text>', 'Status text')
    .option('--text-file <path>', 'Read status text from this file with --text as fallback')
    .option(
      '--interval <seconds>',
      'Seconds between status refreshes',
      DEFAULT_KEEP_ALIVE_INTERVAL_SECONDS.toString()
    )
    .option(
      '--max-duration <seconds>',
      'Maximum keep-alive duration in seconds',
      DEFAULT_KEEP_ALIVE_MAX_DURATION_SECONDS.toString()
    )
    .option('--stop-file <path>', 'Stop when this file exists')
    .option(
      '--loading-message <message>',
      'Loading message shown by Slack; can be specified up to 10 times',
      collectLoadingMessage,
      []
    )
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        validateStatusBase,
        validateStatusText,
        validateLoadingMessages,
        (options) => validatePositiveIntegerOption(options, 'interval', '--interval'),
        (options) => validatePositiveIntegerOption(options, 'maxDuration', '--max-duration'),
        validateDetachOptions,
        validateDistinctLifecycleFiles,
      ])
    )
    .option('--detach', 'Run keep-alive in a detached background process')
    .option('--pid-file <path>', 'Write the keep-alive process ID to this file')
    .option('--log-file <path>', 'Append timestamped keep-alive activity logs to this file')
    .action(wrapCommand(runKeepAlive));

  const stopCommand = new Command('stop')
    .description('Stop a keep-alive process and clear assistant status')
    .option('-c, --channel <channel>', 'Target channel name or ID')
    .option('-t, --thread <thread>', 'Thread parent timestamp')
    .option('--stop-file <path>', 'Create this stop file before stopping')
    .option('--pid-file <path>', 'Read and stop the process ID from this file')
    .option(
      '--timeout <seconds>',
      'Seconds to wait after SIGTERM before SIGKILL',
      DEFAULT_STOP_TIMEOUT_SECONDS.toString()
    )
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        validateStatusBase,
        (options) => validatePositiveIntegerOption(options, 'timeout', '--timeout'),
      ])
    )
    .action(wrapCommand(runStop));

  statusCommand.addCommand(setCommand);
  statusCommand.addCommand(clearCommand);
  statusCommand.addCommand(keepAliveCommand);
  statusCommand.addCommand(stopCommand);

  return statusCommand;
}
