import { describe, expect, it } from 'vitest';
import { formatMessageWithMentions, resolveUsername } from '../../src/utils/format-utils';
import { Message } from '../../src/utils/slack-api-client';

describe('formatMessageWithMentions', () => {
  it('should replace user ID mentions with usernames', () => {
    const message = 'Hello <@U784E34>, please check this';
    const users = new Map([['U784E34', 'sakashita']]);

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('Hello @sakashita, please check this');
  });

  it('should handle multiple mentions', () => {
    const message = '<@U784E34> and <@U123456> are working on this';
    const users = new Map([
      ['U784E34', 'sakashita'],
      ['U123456', 'tanaka'],
    ]);

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('@sakashita and @tanaka are working on this');
  });

  it('should keep user ID if username is not found', () => {
    const message = 'Hello <@U784E34>, please check this';
    const users = new Map<string, string>();

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('Hello @U784E34, please check this');
  });

  it('should handle messages without mentions', () => {
    const message = 'This is a regular message';
    const users = new Map<string, string>();

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('This is a regular message');
  });

  it('should handle empty message', () => {
    const message = '';
    const users = new Map<string, string>();

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('');
  });

  it('should handle malformed mentions', () => {
    const message = 'Hello <@>, <@ >, <@invalid';
    const users = new Map<string, string>();

    const result = formatMessageWithMentions(message, users);

    expect(result).toBe('Hello <@>, <@ >, <@invalid');
  });
});

describe('resolveUsername', () => {
  it('should resolve user ID to username', () => {
    const message: Message = { type: 'message', ts: '1609459200.000100', user: 'U123456' };
    const users = new Map([['U123456', 'john.doe']]);

    expect(resolveUsername(message, users)).toBe('john.doe');
  });

  it('should return "Unknown User" when user ID is not in the map', () => {
    const message: Message = { type: 'message', ts: '1609459200.000100', user: 'U999999' };
    const users = new Map<string, string>();

    expect(resolveUsername(message, users)).toBe('Unknown User');
  });

  it('should return "Bot" when message has bot_id but no user', () => {
    const message: Message = { type: 'message', ts: '1609459200.000100', bot_id: 'B123456' };
    const users = new Map<string, string>();

    expect(resolveUsername(message, users)).toBe('Bot');
  });

  it('should return "Unknown" when message has neither user nor bot_id', () => {
    const message: Message = { type: 'message', ts: '1609459200.000100' };
    const users = new Map<string, string>();

    expect(resolveUsername(message, users)).toBe('Unknown');
  });
});
