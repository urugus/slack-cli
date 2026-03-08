import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReminderFormatter,
  ReminderFormatterOptions,
} from '../../../src/utils/formatters/reminder-formatters';

describe('reminder formatters', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleReminders = [
    {
      id: 'Rm01ABCDEF',
      text: 'PRレビューする',
      time: 1709290800,
      complete_ts: 0,
      recurring: false,
    },
    {
      id: 'Rm02GHIJKL',
      text: 'デプロイ確認',
      time: 1709294400,
      complete_ts: 1709295000,
      recurring: false,
    },
  ];

  describe('table formatter', () => {
    it('should format reminders as table', () => {
      const formatter = createReminderFormatter('table');
      formatter.format({ reminders: sampleReminders });

      expect(logSpy).toHaveBeenCalled();
      // Check header is output
      const firstCall = logSpy.mock.calls[0][0];
      expect(firstCall).toContain('ID');
      expect(firstCall).toContain('Text');
      expect(firstCall).toContain('Time');
      expect(firstCall).toContain('Status');
    });

    it('should show pending status for incomplete reminders', () => {
      const formatter = createReminderFormatter('table');
      formatter.format({
        reminders: [
          {
            id: 'Rm01ABCDEF',
            text: 'Test',
            time: 1709290800,
            complete_ts: 0,
            recurring: false,
          },
        ],
      });

      const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('pending');
    });

    it('should show completed status for completed reminders', () => {
      const formatter = createReminderFormatter('table');
      formatter.format({
        reminders: [
          {
            id: 'Rm01ABCDEF',
            text: 'Test',
            time: 1709290800,
            complete_ts: 1709295000,
            recurring: false,
          },
        ],
      });

      const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('completed');
    });
  });

  describe('simple formatter', () => {
    it('should format reminders in simple format', () => {
      const formatter = createReminderFormatter('simple');
      formatter.format({ reminders: sampleReminders });

      expect(logSpy).toHaveBeenCalledTimes(2);
      const firstCall = logSpy.mock.calls[0][0];
      expect(firstCall).toContain('Rm01ABCDEF');
      expect(firstCall).toContain('PRレビューする');
    });
  });

  describe('json formatter', () => {
    it('should format reminders as JSON', () => {
      const formatter = createReminderFormatter('json');
      formatter.format({ reminders: sampleReminders });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(2);
      expect(output[0].id).toBe('Rm01ABCDEF');
      expect(output[0].text).toBe('PRレビューする');
      expect(output[0].status).toBe('pending');
      expect(output[1].status).toBe('completed');
    });
  });

  describe('factory', () => {
    it('should default to table format for unknown format', () => {
      const formatter = createReminderFormatter('unknown');
      formatter.format({ reminders: sampleReminders });

      // Should not throw and should produce table output
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
