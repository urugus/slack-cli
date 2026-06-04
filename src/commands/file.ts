import chalk from 'chalk';
import { Command } from 'commander';
import { FileDownloadOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { FileError } from '../utils/errors';
import { parseProfile } from '../utils/option-parsers';
import { sanitizeTerminalText } from '../utils/terminal-sanitizer';

interface ParsedSlackMessageUrl {
  channel: string;
  messageTs: string;
  threadTs?: string;
}

export function setupFileCommand(): Command {
  const fileCommand = new Command('file').description('Manage Slack files');

  fileCommand
    .command('download')
    .description('Download a file attached to a Slack message')
    .option('--id <fileId>', 'Slack file ID (for example F012ABCDEF)')
    .option('--url <url>', 'Slack message permalink containing the file')
    .option('-c, --channel <channel>', 'Channel name or ID')
    .option('-t, --timestamp <timestamp>', 'Message timestamp containing the file')
    .option('--thread <thread>', 'Thread timestamp when the message is a thread reply')
    .option('--index <index>', '1-based file index when the message has multiple files', '1')
    .option('-o, --output <path>', 'Output file path')
    .option('-d, --dir <directory>', 'Output directory', '.')
    .option('--force', 'Overwrite the output file if it already exists', false)
    .option('--profile <profile>', 'Use specific workspace profile')
    .action(
      wrapCommand(async (options: FileDownloadOptions) => {
        const source = resolveDownloadSource(options);
        const fileIndex = parseFileIndex(options.index);
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const result = await client.downloadFile({
          fileId: source.fileId,
          channel: source.channel,
          messageTs: source.messageTs,
          threadTs: source.threadTs,
          fileIndex,
          outputPath: options.output,
          outputDir: options.output ? undefined : options.dir,
          force: options.force ?? false,
        });

        const name = sanitizeTerminalText(
          result.file.name || result.file.title || result.file.id || 'Slack file'
        );
        const outputPath = sanitizeTerminalText(result.path);
        console.log(chalk.green(`✓ Downloaded ${name} to ${outputPath} (${result.bytes} bytes)`));
      })
    );

  return fileCommand;
}

function resolveDownloadSource(options: FileDownloadOptions): {
  fileId?: string;
  channel?: string;
  messageTs?: string;
  threadTs?: string;
} {
  if (options.output && options.dir && options.dir !== '.') {
    throw new FileError('Cannot use both --output and --dir');
  }

  const hasMessageSource = Boolean(options.channel || options.timestamp || options.thread);
  const sourceCount = [Boolean(options.id), Boolean(options.url), hasMessageSource].filter(
    Boolean
  ).length;

  if (sourceCount !== 1) {
    throw new FileError('Specify exactly one source: --id, --url, or --channel with --timestamp');
  }

  if (options.id) {
    return { fileId: options.id };
  }

  if (options.url) {
    const parsed = parseSlackMessageUrl(options.url);
    return {
      channel: parsed.channel,
      messageTs: parsed.messageTs,
      threadTs: parsed.threadTs,
    };
  }

  if (!options.channel || !options.timestamp) {
    throw new FileError('--channel and --timestamp must be specified together');
  }

  return {
    channel: options.channel,
    messageTs: options.timestamp,
    threadTs: options.thread,
  };
}

function parseSlackMessageUrl(value: string): ParsedSlackMessageUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FileError(`Invalid Slack message URL: ${value}`);
  }

  const match = url.pathname.match(/\/archives\/([^/]+)\/p(\d+)/);
  if (!match) {
    throw new FileError(`Invalid Slack message URL: ${value}`);
  }

  return {
    channel: match[1],
    messageTs: permalinkTimestampToSlackTs(match[2]),
    threadTs: url.searchParams.get('thread_ts') || undefined,
  };
}

function permalinkTimestampToSlackTs(value: string): string {
  if (value.length <= 10) {
    throw new FileError(`Invalid Slack permalink timestamp: ${value}`);
  }

  return `${value.slice(0, 10)}.${value.slice(10)}`;
}

function parseFileIndex(value?: string): number {
  const rawValue = (value || '1').trim();

  if (!/^\d+$/.test(rawValue)) {
    throw new FileError('--index must be a positive integer');
  }

  const fileIndex = Number.parseInt(rawValue, 10);

  if (fileIndex < 1) {
    throw new FileError('--index must be a positive integer');
  }

  return fileIndex;
}
