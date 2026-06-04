import { afterEach, describe, expect, it, vi } from 'vitest';
import { wrapCommand } from '../../src/utils/command-wrapper';
import { restoreMocks, setupMockConsole } from '../test-utils';

describe('wrapCommand', () => {
  afterEach(() => {
    restoreMocks();
  });

  it('should sanitize control characters in error output', async () => {
    const mockConsole = setupMockConsole();
    const action = wrapCommand(async () => {
      throw new Error('\u001b[31mboom\u001b[0m');
    });

    await action({});

    expect(mockConsole.errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'boom');
    expect(mockConsole.errorSpy.mock.calls[0][1]).not.toContain('\u001b');
    expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
  });
});
