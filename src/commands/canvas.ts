import chalk from 'chalk';
import { Command } from 'commander';
import { CanvasListOptions, CanvasReadOptions } from '../types/commands';
import { CanvasFile, CanvasSection, CanvasSectionElement } from '../types/slack';
import { renderByFormat, withSlackClient } from '../utils/command-support';
import { wrapCommand } from '../utils/command-wrapper';
import { sanitizeTerminalText } from '../utils/terminal-sanitizer';
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

function formatSectionsTable(sections: CanvasSection[]): void {
  sections.forEach((section) => {
    const text = section.elements ? extractText(section.elements) : '';
    console.log(
      chalk.cyan(`ID: ${sanitizeTerminalText(section.id || '(no id)')}`) +
        `  Content: ${text || '(no content)'}`
    );
  });
}

function formatSectionsSimple(sections: CanvasSection[]): void {
  sections.forEach((section) => {
    const text = section.elements ? extractText(section.elements) : '';
    console.log(`${sanitizeTerminalText(section.id || '(no id)')}\t${text || '(no content)'}`);
  });
}

function formatCanvasesTable(canvases: CanvasFile[]): void {
  canvases.forEach((canvas) => {
    console.log(
      chalk.cyan(`ID: ${sanitizeTerminalText(canvas.id || '(no id)')}`) +
        `  Name: ${sanitizeTerminalText(canvas.name || '(no name)')}`
    );
  });
}

function formatCanvasesSimple(canvases: CanvasFile[]): void {
  canvases.forEach((canvas) => {
    console.log(
      `${sanitizeTerminalText(canvas.id || '(no id)')}\t${sanitizeTerminalText(canvas.name || '(no name)')}`
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
        await withSlackClient(options, async (client) => {
          const sections = await client.readCanvas(options.id);

          if (sections.length === 0) {
            console.log('No sections found in canvas');
            return;
          }

          renderByFormat(options, sections, {
            table: formatSectionsTable,
            simple: formatSectionsSimple,
          });
        });
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
        await withSlackClient(options, async (client) => {
          const canvases = await client.listCanvases(options.channel);

          if (canvases.length === 0) {
            console.log('No canvases found in channel');
            return;
          }

          renderByFormat(options, canvases, {
            table: formatCanvasesTable,
            simple: formatCanvasesSimple,
          });
        });
      })
    );

  canvasCommand.addCommand(readCommand);
  canvasCommand.addCommand(listCommand);

  return canvasCommand;
}
