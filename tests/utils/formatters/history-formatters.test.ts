import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Message } from '../../../src/types/slack';
import {
  createHistoryFormatter,
  HistoryFormatterOptions,
} from '../../../src/utils/formatters/history-formatters';

describe('JsonHistoryFormatter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const baseMessage: Message = {
    type: 'message',
    ts: '1700000000.000000',
    text: 'Hello world',
    user: 'U123',
  };

  const createOptions = (messages: Message[]): HistoryFormatterOptions => ({
    channelName: 'general',
    messages,
    users: new Map([['U123', 'testuser']]),
  });

  const capturedJson = (): { messages: Array<Record<string, unknown>> } => {
    const call = consoleSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].startsWith('{')
    );
    expect(call, 'expected JSON output via console.log').toBeTruthy();
    return JSON.parse(call?.[0] as string);
  };

  describe('blocks / attachments passthrough', () => {
    it('should include blocks field when message has blocks', () => {
      const message: Message = {
        ...baseMessage,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'block body' } }],
      };

      const formatter = createHistoryFormatter('json');
      formatter.format(createOptions([message]));

      const parsed = capturedJson();
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]).toHaveProperty('blocks');
      expect(parsed.messages[0].blocks).toEqual(message.blocks);
    });

    it('should include attachments field when message has attachments', () => {
      const message: Message = {
        ...baseMessage,
        attachments: [{ id: 1, fallback: 'fallback', text: 'attachment body' }],
      };

      const formatter = createHistoryFormatter('json');
      formatter.format(createOptions([message]));

      const parsed = capturedJson();
      expect(parsed.messages[0]).toHaveProperty('attachments');
      expect(parsed.messages[0].attachments).toEqual(message.attachments);
    });

    it('should omit blocks when message has empty blocks array', () => {
      const message: Message = { ...baseMessage, blocks: [] };

      const formatter = createHistoryFormatter('json');
      formatter.format(createOptions([message]));

      const parsed = capturedJson();
      expect(parsed.messages[0]).not.toHaveProperty('blocks');
    });

    it('should omit attachments when message has empty attachments array', () => {
      const message: Message = { ...baseMessage, attachments: [] };

      const formatter = createHistoryFormatter('json');
      formatter.format(createOptions([message]));

      const parsed = capturedJson();
      expect(parsed.messages[0]).not.toHaveProperty('attachments');
    });

    it('should include both blocks and attachments when present', () => {
      const message: Message = {
        ...baseMessage,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'b' } }],
        attachments: [{ id: 1, fallback: 'f' }],
      };

      const formatter = createHistoryFormatter('json');
      formatter.format(createOptions([message]));

      const parsed = capturedJson();
      expect(parsed.messages[0].blocks).toEqual(message.blocks);
      expect(parsed.messages[0].attachments).toEqual(message.attachments);
    });
  });
});
