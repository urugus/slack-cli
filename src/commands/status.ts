import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs';
import type {
  StatusClearOptions,
  StatusKeepAliveOptions,
  StatusSetOptions,
} from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { extractErrorMessage } from '../utils/error-utils';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, formatValidators } from '../utils/validators';

const DEFAULT_KEEP_ALIVE_INTERVAL_SECONDS = 80;
const DEFAULT_KEEP_ALIVE_MAX_DURATION_SECONDS = 600;
const MAX_LOADING_MESSAGES = 10;

type StatusCommandOptions = {
  channel?: string;
  thread?: string;
  text?: string;
  interval?: string;
  maxDuration?: string;
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
  optionName: 'interval' | 'maxDuration',
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

async function runKeepAlive(options: StatusKeepAliveOptions): Promise<void> {
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
  const client = await createSlackClient(profile);
  const startedAt = Date.now();
  let stopRequested = false;
  let wakeDelay: (() => void) | undefined;

  const requestStop = () => {
    stopRequested = true;
    wakeDelay?.();
  };

  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);

  try {
    await client.setAssistantThreadStatus({
      channel: options.channel,
      threadTs: options.thread,
      status: options.text,
      loadingMessages: options.loadingMessage,
    });

    while (!stopRequested) {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = maxDurationMs - elapsedMs;
      if (remainingMs <= 0) {
        break;
      }

      await createInterruptibleDelay(
        Math.min(intervalMs, remainingMs),
        () => stopRequested,
        (wake) => {
          wakeDelay = wake;
        }
      );

      if (stopRequested) {
        break;
      }

      if (options.stopFile && fs.existsSync(options.stopFile)) {
        break;
      }

      if (Date.now() - startedAt >= maxDurationMs) {
        break;
      }

      try {
        await client.setAssistantThreadStatus({
          channel: options.channel,
          threadTs: options.thread,
          status: options.text,
          loadingMessages: options.loadingMessage,
        });
      } catch (error) {
        console.error(chalk.yellow('Warning:'), extractErrorMessage(error));
      }
    }
  } finally {
    process.off('SIGINT', requestStop);
    process.off('SIGTERM', requestStop);
    await clearStatusIgnoringErrors(client, options.channel, options.thread);
  }
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
      ])
    )
    .action(wrapCommand(runKeepAlive));

  statusCommand.addCommand(setCommand);
  statusCommand.addCommand(clearCommand);
  statusCommand.addCommand(keepAliveCommand);

  return statusCommand;
}
