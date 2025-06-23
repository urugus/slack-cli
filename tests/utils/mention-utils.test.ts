import { describe, it, expect } from 'vitest';
import { extractUserIdsFromMentions, extractAllUserIds } from '../../src/utils/mention-utils';

describe('mention-utils', () => {
  describe('extractUserIdsFromMentions', () => {
    it('should extract single user ID from mention', () => {
      const text = 'Hello <@U123456789>';
      const userIds = extractUserIdsFromMentions(text);
      expect(userIds).toEqual(['U123456789']);
    });

    it('should extract multiple user IDs from mentions', () => {
      const text = 'Hey <@U123456789> and <@U987654321>, please check this';
      const userIds = extractUserIdsFromMentions(text);
      expect(userIds).toEqual(['U123456789', 'U987654321']);
    });

    it('should handle duplicate mentions', () => {
      const text = '<@U123456789> mentioned <@U123456789> again';
      const userIds = extractUserIdsFromMentions(text);
      expect(userIds).toEqual(['U123456789', 'U123456789']);
    });

    it('should return empty array for text without mentions', () => {
      const text = 'No mentions here';
      const userIds = extractUserIdsFromMentions(text);
      expect(userIds).toEqual([]);
    });

    it('should handle empty text', () => {
      const userIds = extractUserIdsFromMentions('');
      expect(userIds).toEqual([]);
    });

    it('should ignore malformed mentions', () => {
      const text = 'Invalid <@> mention and <@lowercase> mention';
      const userIds = extractUserIdsFromMentions(text);
      expect(userIds).toEqual([]);
    });
  });

  describe('extractAllUserIds', () => {
    it('should extract user IDs from message authors only', () => {
      const messages = [
        { user: 'U111111111', text: 'Hello world' },
        { user: 'U222222222', text: 'Hi there' },
      ];
      const userIds = extractAllUserIds(messages);
      expect(userIds).toEqual(['U111111111', 'U222222222']);
    });

    it('should extract user IDs from mentions only', () => {
      const messages = [
        { text: 'Hello <@U333333333>' },
        { text: 'Hi <@U444444444>' },
      ];
      const userIds = extractAllUserIds(messages);
      expect(userIds).toEqual(['U333333333', 'U444444444']);
    });

    it('should extract both authors and mentioned users', () => {
      const messages = [
        { user: 'U111111111', text: 'Hello <@U222222222>' },
        { user: 'U333333333', text: 'Hi <@U444444444> and <@U555555555>' },
      ];
      const userIds = extractAllUserIds(messages);
      expect(userIds.sort()).toEqual([
        'U111111111',
        'U222222222',
        'U333333333',
        'U444444444',
        'U555555555',
      ]);
    });

    it('should remove duplicate user IDs', () => {
      const messages = [
        { user: 'U111111111', text: 'Hello <@U111111111>' },
        { user: 'U111111111', text: 'Another message' },
      ];
      const userIds = extractAllUserIds(messages);
      expect(userIds).toEqual(['U111111111']);
    });

    it('should handle messages without user or text', () => {
      const messages = [
        { user: 'U111111111' },
        { text: 'No user here' },
        {},
      ];
      const userIds = extractAllUserIds(messages);
      expect(userIds).toEqual(['U111111111']);
    });

    it('should handle empty messages array', () => {
      const userIds = extractAllUserIds([]);
      expect(userIds).toEqual([]);
    });
  });
});