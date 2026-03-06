import chalk from 'chalk';
import { Command } from 'commander';
import { CanvasListOptions, CanvasReadOptions } from '../types/commands';
import { createSlackClient } from '../utils/client-factory';
import { wrapCommand } from '../utils/command-wrapper';
import { parseFormat, parseProfile } from '../utils/option-parsers';
import { CanvasFile, CanvasSection, CanvasSectionElement } from '../utils/slack-api-client';
import { sanitizeTerminalData, sanitizeTerminalText } from '../utils/terminal-sanitizer';
import { createValidationHook, optionValidators } from '../utils/validators';

function extractText(elements: CanvasSectionElement[]): string {
  return elements
    .map((el) => {
      if (el.text) return sanitizeTerminalText(el.text);
      if (el.elements) return extractText(el.elements);
      return '';
    })
    .join('');
}

function formatSections(sections: CanvasSection[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(sanitizeTerminalData(sections)));
    return;
  }

  if (format === 'simple') {
    sections.forEach((section) => {
      const text = section.elements ? extractText(section.elements) : '';
      console.log(`${sanitizeTerminalText(section.id || '(no id)')}\t${text || '(no content)'}`);
    });
    return;
  }

  // table format (default)
  sections.forEach((section) => {
    const text = section.elements ? extractText(section.elements) : '';
    console.log(
      chalk.cyan(`ID: ${sanitizeTerminalText(section.id || '(no id)')}`) +
        `  Content: ${text || '(no content)'}`
    );
  });
}

function formatCanvases(canvases: CanvasFile[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(sanitizeTerminalData(canvases)));
    return;
  }

  if (format === 'simple') {
    canvases.forEach((canvas) => {
      console.log(
        `${sanitizeTerminalText(canvas.id || '(no id)')}\t${sanitizeTerminalText(canvas.name || '(no name)')}`
      );
    });
    return;
  }

  // table format (default)
  canvases.forEach((canvas) => {
    console.log(
      chalk.cyan(`ID: ${sanitizeTerminalText(canvas.id || '(no id)')}`) +
        `  Name: ${sanitizeTerminalText(canvas.name || '(no name)')}`
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
