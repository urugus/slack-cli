import { Command } from 'commander';
import chalk from 'chalk';
import { wrapCommand } from '../utils/command-wrapper';
import { createSlackClient } from '../utils/client-factory';
import { CanvasReadOptions, CanvasListOptions } from '../types/commands';
import { parseFormat, parseProfile } from '../utils/option-parsers';
import { createValidationHook, optionValidators } from '../utils/validators';
import { CanvasSection, CanvasFile } from '../utils/slack-api-client';

function formatSections(sections: CanvasSection[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(sections));
    return;
  }

  if (format === 'simple') {
    sections.forEach((section) => {
      console.log(section.id || '(no id)');
    });
    return;
  }

  // table format (default)
  sections.forEach((section) => {
    console.log(chalk.cyan(`ID: ${section.id || '(no id)'}`));
  });
}

function formatCanvases(canvases: CanvasFile[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(canvases));
    return;
  }

  if (format === 'simple') {
    canvases.forEach((canvas) => {
      console.log(`${canvas.id}\t${canvas.name || '(no name)'}`);
    });
    return;
  }

  // table format (default)
  canvases.forEach((canvas) => {
    console.log(
      chalk.cyan(`ID: ${canvas.id || '(no id)'}`) + `  Name: ${canvas.name || '(no name)'}`
    );
  });
}

export function setupCanvasCommand(): Command {
  const canvasCommand = new Command('canvas').description('Manage Slack Canvases');

  const readCommand = new Command('read')
    .description('Get the sections of a Canvas')
    .requiredOption('-i, --id <canvas-id>', 'Canvas ID')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: CanvasReadOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const sections = await client.readCanvas(options.id);

        if (sections.length === 0) {
          console.log('No sections found in canvas');
          return;
        }

        const format = parseFormat(options.format);
        formatSections(sections, format);
      })
    );

  const listCommand = new Command('list')
    .description('List canvases linked to a channel')
    .requiredOption('-c, --channel <channel>', 'Channel name or ID')
    .option('--format <format>', 'Output format: table, simple, json', 'table')
    .option('--profile <profile>', 'Use specific workspace profile')
    .hook('preAction', createValidationHook([optionValidators.format]))
    .action(
      wrapCommand(async (options: CanvasListOptions) => {
        const profile = parseProfile(options.profile);
        const client = await createSlackClient(profile);

        const canvases = await client.listCanvases(options.channel);

        if (canvases.length === 0) {
          console.log('No canvases found in channel');
          return;
        }

        const format = parseFormat(options.format);
        formatCanvases(canvases, format);
      })
    );

  canvasCommand.addCommand(readCommand);
  canvasCommand.addCommand(listCommand);

  return canvasCommand;
}
