import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMembersFormatter,
  MembersFormatterOptions,
} from '../../../src/utils/formatters/members-formatters';

describe('members formatters', () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleMembers: MembersFormatterOptions = {
    members: [
      { id: 'U01ABCDEF', name: 'alice', realName: 'Alice Smith' },
      { id: 'U02GHIJKL', name: 'bob', realName: 'Bob Jones' },
      { id: 'U03MNOPQR', name: undefined, realName: undefined },
    ],
  };

  describe('table format', () => {
    it('should render members in table format with header', () => {
      const formatter = createMembersFormatter('table');
      formatter.format(sampleMembers);

      // Should have header line and separator
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ID'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Name'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Real Name'));

      // Should have data rows
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('U01ABCDEF'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('alice'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Alice Smith'));
    });

    it('should handle members with no name/realName', () => {
      const formatter = createMembersFormatter('table');
      formatter.format({
        members: [{ id: 'U03MNOPQR', name: undefined, realName: undefined }],
      });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('U03MNOPQR'));
    });
  });

  describe('simple format', () => {
    it('should render members in simple tab-separated format', () => {
      const formatter = createMembersFormatter('simple');
      formatter.format(sampleMembers);

      expect(logSpy).toHaveBeenCalledWith('U01ABCDEF\talice\tAlice Smith');
      expect(logSpy).toHaveBeenCalledWith('U02GHIJKL\tbob\tBob Jones');
      expect(logSpy).toHaveBeenCalledWith('U03MNOPQR\t\t');
    });
  });

  describe('json format', () => {
    it('should render members as JSON', () => {
      const formatter = createMembersFormatter('json');
      formatter.format(sampleMembers);

      const expected = JSON.stringify(
        [
          { id: 'U01ABCDEF', name: 'alice', real_name: 'Alice Smith' },
          { id: 'U02GHIJKL', name: 'bob', real_name: 'Bob Jones' },
          { id: 'U03MNOPQR', name: '', real_name: '' },
        ],
        null,
        2
      );
      expect(logSpy).toHaveBeenCalledWith(expected);
    });
  });

  describe('factory', () => {
    it('should default to table format for unknown format', () => {
      const formatter = createMembersFormatter('unknown');
      formatter.format(sampleMembers);

      // Should render as table (with header)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ID'));
    });
  });
});
