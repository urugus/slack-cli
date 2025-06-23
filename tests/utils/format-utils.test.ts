import { describe, it, expect } from 'vitest';
import { formatMessageWithMentions } from '../../src/utils/format-utils';

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
      ['U123456', 'tanaka']
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