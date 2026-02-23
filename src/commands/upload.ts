import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { UploadOptions } from '../types/commands';
import { parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { FileError } from '../utils/errors';
import * as fs from 'fs/promises';

export function setupUploadCommand(): Command {
  const uploadCommand = new Command('upload')
    .description('Upload a file or snippet to a Slack channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .option('-f, --file <file>', 'File path to upload')
    .option('--content <content>', 'Text content to upload as snippet')
    .option('--filename <filename>', 'Override filename')
    .option('--title <title>', 'File title')
    .option('-m, --message <message>', 'Initial comment with the file')
    .option('--filetype <filetype>', 'Snippet type (e.g. python, javascript, csv)')
    .option('-t, --thread <thread>', 'Thread timestamp to upload as reply')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook(
      'preAction',
      createValidationHook([optionValidators.fileOrContent, optionValidators.uploadThreadTimestamp])
    )
    .action(
      wrapCommand(async (options: UploadOptions) => {
        // Verify file exists if file path provided
        if (options.file) {
          try {
            await fs.access(options.file);
          } catch {
            throw new FileError(`File not found: ${options.file}`);
          }
        }

        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        if (options.file) {
          await client.uploadFile({
            channel: options.channel,
            filePath: options.file,
            title: options.title,
            initialComment: options.message,
            snippetType: options.filetype,
            threadTs: options.thread,
            filename: options.filename,
          });
        } else {
          await client.uploadFile({
            channel: options.channel,
            content: options.content!,
            title: options.title,
            initialComment: options.message,
            snippetType: options.filetype,
            threadTs: options.thread,
            filename: options.filename,
          });
        }

        console.log(chalk.green(`✓ File uploaded successfully to #${options.channel}`));
      })
    );

  return uploadCommand;
}
