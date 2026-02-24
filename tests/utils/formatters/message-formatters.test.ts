import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createMessageFormatter, MessageFormatterOptions } from '../../../src/utils/formatters/message-formatters';
import { Channel, Message } from '../../../src/utils/slack-api-client';

describe('MessageFormatters', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const createChannel = (overrides: Partial<Channel> = {}): Channel => ({
    id: 'C123',
    name: 'general',
    is_private: false,
    created: 1234567890,
    unread_count: 3,
    unread_count_display: 3,
    ...overrides,
  });

  const createMessage = (overrides: Partial<Message> = {}): Message => ({
    type: 'message',
    ts: '1700000000.000000',
    text: 'Hello world',
    user: 'U123',
    ...overrides,
  });

  const createOptions = (overrides: Partial<MessageFormatterOptions> = {}): MessageFormatterOptions => ({
    channel: createChannel(),
    messages: [createMessage()],
    users: new Map([['U123', 'testuser']]),
    countOnly: false,
    format: 'table',
    ...overrides,
  });

  describe('type safety', () => {
    it('should accept Channel type for channel property', () => {
      const channel: Channel = createChannel();
      const options = createOptions({ channel });

      // The formatter should work without type assertion
      const formatter = createMessageFormatter('table');
      expect(() => formatter.format(options)).not.toThrow();
    });

    it('should accept Message[] type for messages property', () => {
      const messages: Message[] = [
        createMessage({ text: 'First message', user: 'U123' }),
        createMessage({ text: 'Second message', user: 'U456', ts: '1700000001.000000' }),
      ];
      const options = createOptions({
        messages,
        users: new Map([['U123', 'user1'], ['U456', 'user2']]),
      });

      const formatter = createMessageFormatter('table');
      expect(() => formatter.format(options)).not.toThrow();
    });
  });

  describe('table formatter', () => {
    it('should display channel name and unread count', () => {
      const options = createOptions();
      const formatter = createMessageFormatter('table');
      formatter.format(options);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('general');
      expect(output).toContain('3 unread messages');
    });

    it('should display messages when countOnly is false', () => {
      const options = createOptions();
      const formatter = createMessageFormatter('table');
      formatter.format(options);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('testuser');
      expect(output).toContain('Hello world');
    });

    it('should not display messages when countOnly is true', () => {
      const options = createOptions({ countOnly: true });
      const formatter = createMessageFormatter('table');
      formatter.format(options);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).not.toContain('Hello world');
    });
  });

  describe('simple formatter', () => {
    it('should display channel name with unread count in compact format', () => {
      const options = createOptions();
      const formatter = createMessageFormatter('simple');
      formatter.format(options);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('general');
      expect(output).toContain('(3)');
    });
  });

  describe('json formatter', () => {
    it('should output valid JSON with proper structure', () => {
      const options = createOptions();
      const formatter = createMessageFormatter('json');
      formatter.format(options);

      const jsonOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveProperty('channel');
      expect(parsed).toHaveProperty('channelId', 'C123');
      expect(parsed).toHaveProperty('unreadCount', 3);
      expect(parsed).toHaveProperty('messages');
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]).toHaveProperty('author', 'testuser');
      expect(parsed.messages[0]).toHaveProperty('text', 'Hello world');
    });

    it('should omit messages array when countOnly is true', () => {
      const options = createOptions({ countOnly: true });
      const formatter = createMessageFormatter('json');
      formatter.format(options);

      const jsonOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveProperty('channel');
      expect(parsed).toHaveProperty('unreadCount', 3);
      expect(parsed).not.toHaveProperty('messages');
    });

    it('should handle messages without user field', () => {
      const options = createOptions({
        messages: [createMessage({ user: undefined })],
      });
      const formatter = createMessageFormatter('json');
      formatter.format(options);

      const jsonOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.messages[0].author).toBe('unknown');
    });
  });

  describe('default fallback', () => {
    it('should fall back to table formatter for unknown format', () => {
      const options = createOptions();
      const formatter = createMessageFormatter('unknown');
      expect(() => formatter.format(options)).not.toThrow();
    });
  });
});
