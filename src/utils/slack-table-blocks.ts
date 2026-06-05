import type { Message } from '../types/slack';
import { sanitizeTerminalData, sanitizeTerminalText } from './terminal-sanitizer';

export type TableOutputFormat = 'markdown' | 'json' | 'tsv';

export interface ExtractedSlackTable {
  messageTs: string;
  tableIndex: number;
  rows: string[][];
}

interface SlackTableBlock {
  type: 'table';
  rows?: unknown;
}

export function extractSlackTables(messages: Message[]): ExtractedSlackTable[] {
  const tables: ExtractedSlackTable[] = [];

  messages.forEach((message) => {
    const blocks = Array.isArray(message.blocks) ? message.blocks : [];

    blocks.forEach((block) => {
      if (!isTableBlock(block)) {
        return;
      }

      tables.push({
        messageTs: message.ts,
        tableIndex: tables.length,
        rows: block.rows.map((row) => row.map(stringifyTableCell)),
      });
    });
  });

  return tables;
}

export function displaySlackTables(messages: Message[], format: TableOutputFormat): void {
  const tables = extractSlackTables(messages);

  if (tables.length === 0) {
    console.log('No tables found');
    return;
  }

  if (format === 'json') {
    console.log(
      JSON.stringify(
        sanitizeTerminalData({
          tables: tables.map((table) => ({
            message_ts: table.messageTs,
            index: table.tableIndex,
            rows: table.rows,
          })),
          total: tables.length,
        }),
        null,
        2
      )
    );
    return;
  }

  if (format === 'tsv') {
    tables.forEach((table, index) => {
      if (index > 0) {
        console.log('');
      }
      table.rows.forEach((row) => console.log(row.map(formatTsvCell).join('\t')));
    });
    return;
  }

  tables.forEach((table, index) => {
    if (index > 0) {
      console.log('');
    }
    renderMarkdownTable(table.rows).forEach((line) => console.log(line));
  });
}

export function parseTableOutputFormat(value?: string): TableOutputFormat {
  const format = value || 'markdown';
  if (format === 'markdown' || format === 'json' || format === 'tsv') {
    return format;
  }

  throw new Error('Invalid table format. Must be one of: markdown, json, tsv');
}

function isTableBlock(value: unknown): value is SlackTableBlock & { rows: unknown[][] } {
  if (!isRecord(value) || value.type !== 'table' || !Array.isArray(value.rows)) {
    return false;
  }

  return value.rows.every((row) => Array.isArray(row));
}

function stringifyTableCell(cell: unknown): string {
  if (!isRecord(cell)) {
    return '';
  }

  if (cell.type === 'raw_text') {
    return sanitizeTerminalText(String(cell.text ?? ''));
  }

  if (cell.type === 'raw_number') {
    return sanitizeTerminalText(String(cell.value ?? cell.text ?? ''));
  }

  if (cell.type === 'rich_text') {
    return sanitizeTerminalText(stringifyRichTextElements(cell.elements));
  }

  return '';
}

function stringifyRichTextElements(elements: unknown): string {
  if (!Array.isArray(elements)) {
    return '';
  }

  return elements.map(stringifyRichTextElement).join('');
}

function stringifyRichTextElement(element: unknown): string {
  if (!isRecord(element)) {
    return '';
  }

  if (typeof element.text === 'string') {
    return element.text;
  }

  if (element.type === 'link') {
    return String(element.url ?? '');
  }

  if (element.type === 'user' && typeof element.user_id === 'string') {
    return `<@${element.user_id}>`;
  }

  if (element.type === 'emoji' && typeof element.name === 'string') {
    return `:${element.name}:`;
  }

  return stringifyRichTextElements(element.elements);
}

function renderMarkdownTable(rows: string[][]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const normalizedRows = rows.map((row) => normalizeRow(row, columnCount));
  const [header, ...body] = normalizedRows;

  return [
    markdownRow(header),
    markdownRow(Array.from({ length: columnCount }, () => '---')),
    ...body.map(markdownRow),
  ];
}

function normalizeRow(row: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function markdownRow(row: string[]): string {
  return `| ${row.map(formatMarkdownCell).join(' | ')} |`;
}

function formatMarkdownCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function formatTsvCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
