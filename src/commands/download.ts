import chalk from 'chalk';
import { Command } from 'commander';
import { resolve } from 'path';
import { DownloadOptions } from '../types/commands';
import { renderByFormat, withSlackClient } from '../utils/command-support';
import { wrapCommand } from '../utils/command-wrapper';
import { FileError } from '../utils/errors';
import { createValidationHook, optionValidators } from '../utils/validators';

export function setupDownloadCommand(): Command {
  const downloadCommand = new Command('download')
    .description('Download files attached to a thread or message')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .requiredOption('-t, --thread <thread>', 'Thread timestamp (the root ts of the thread)')
    .option('--ts <ts>', 'Only download files attached to the message with this timestamp')
    .option('-o, --output <dir>', 'Output directory', '.')
    .option('--list', 'List attached files without downloading', false)
    .option('--format <format>', 'Output format for --list: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([
        optionValidators.threadTimestamp,
        optionValidators.downloadMessageTs,
        optionValidators.format,
      ])
    )
    .action(
      wrapCommand(async (options: DownloadOptions) => {
        await withSlackClient(options, async (client) => {
          const files = await client.listThreadFiles(options.channel, options.thread, {
            messageTs: options.ts,
          });

          if (files.length === 0) {
            console.log('No files found in the specified thread or message.');
            return;
          }

          if (options.list) {
            renderByFormat(options, files, {
              table: (data) => {
                for (const file of data) {
                  const name = file.name || file.title || '(no name)';
                  console.log(
                    `${file.id}\t${name}\t${file.filetype ?? '?'}\t${file.size ?? 0} bytes`
                  );
                }
              },
            });
            return;
          }

          const outputDir = resolve(options.output ?? '.');
          let downloaded = 0;

          for (const file of files) {
            try {
              const result = await client.downloadFile(file, outputDir);
              downloaded++;
              console.log(chalk.green(`✓ ${result.name} (${result.size} bytes) -> ${result.path}`));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(chalk.yellow(`⚠ Skipped ${file.name || file.id}: ${message}`));
            }
          }

          // Surface a final tally so partial downloads are never silent.
          const summary = `Downloaded ${downloaded}/${files.length} file(s) to ${outputDir}`;
          if (downloaded === files.length) {
            console.log(chalk.green(`✓ ${summary}`));
          } else {
            // Exit non-zero on partial failure so scripts/CI can detect it.
            console.log(chalk.yellow(`⚠ ${summary}`));
            throw new FileError(`${files.length - downloaded} file(s) could not be downloaded.`);
          }
        });
      })
    );

  return downloadCommand;
}
