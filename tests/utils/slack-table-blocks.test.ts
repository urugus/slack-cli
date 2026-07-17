import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../src/types/slack';
import {
  displaySlackTables,
  extractSlackTables,
  parseTableOutputFormat,
} from '../../src/utils/slack-table-blocks';

const messagesWithTables = [
  {
    ts: '1000.000001',
    blocks: [
      {
        type: 'table',
        rows: [
          [
            { type: 'raw_text', text: 'Name' },
            { type: 'raw_number', value: 42 },
          ],
          [
            {
              type: 'rich_text',
              elements: [
                { text: 'hello ' },
                { type: 'link', url: 'https://example.com' },
                { type: 'user', user_id: 'U123' },
                { type: 'emoji', name: 'wave' },
              ],
            },
            { type: 'unknown' },
          ],
        ],
      },
      { type: 'section', text: { text: 'ignored' } },
    ],
    attachments: [
      {
        blocks: [
          {
            type: 'table',
            rows: [[{ type: 'raw_text', text: 'Attachment\ncell|value\tend' }]],
          },
        ],
      },
    ],
  },
] as Message[];

describe('slack-table-blocks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts table rows from message blocks and attachment blocks', () => {
    expect(extractSlackTables(messagesWithTables)).toEqual([
      {
        messageTs: '1000.000001',
        tableIndex: 0,
        rows: [
          ['Name', '42'],
          ['hello https://example.com<@U123>:wave:', ''],
        ],
      },
      {
        messageTs: '1000.000001',
        tableIndex: 1,
        rows: [['Attachment\ncell|value\tend']],
      },
    ]);
  });

  it('ignores malformed table-like blocks', () => {
    expect(
      extractSlackTables([
        { ts: '1', blocks: [{ type: 'table', rows: ['not-row'] }] },
        { ts: '2', attachments: [{ blocks: [{ type: 'table' }] }] },
      ] as Message[])
    ).toEqual([]);
  });

  it('displays markdown, TSV, JSON, and no-table output', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    displaySlackTables(messagesWithTables, 'markdown');
    expect(logSpy).toHaveBeenCalledWith('| Name | 42 |');
    expect(logSpy).toHaveBeenCalledWith('| --- | --- |');
    expect(logSpy).toHaveBeenCalledWith('| Attachment cell\\|value\tend |');

    logSpy.mockClear();
    displaySlackTables(messagesWithTables, 'tsv');
    expect(logSpy).toHaveBeenCalledWith('Name\t42');
    expect(logSpy).toHaveBeenCalledWith('Attachment cell|value end');

    logSpy.mockClear();
    displaySlackTables(messagesWithTables, 'json');
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.total).toBe(2);
    expect(parsed.tables[0]).toMatchObject({
      message_ts: '1000.000001',
      index: 0,
    });

    logSpy.mockClear();
    displaySlackTables([{ ts: '3', text: 'plain' }] as Message[], 'markdown');
    expect(logSpy).toHaveBeenCalledWith('No tables found');
  });

  it('parses output format options', () => {
    expect(parseTableOutputFormat()).toBe('markdown');
    expect(parseTableOutputFormat('markdown')).toBe('markdown');
    expect(parseTableOutputFormat('json')).toBe('json');
    expect(parseTableOutputFormat('tsv')).toBe('tsv');
    expect(() => parseTableOutputFormat('csv')).toThrow('Invalid table format');
  });
});
