import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfigOrThrow } from '../../src/utils/config-helper';
import type { ProfileConfigManager } from '../../src/utils/profile-config';

function fakeManager(token: string | null) {
  return {
    getConfig: vi.fn(async () => (token ? { token, updatedAt: '' } : null)),
    listProfiles: vi.fn(async () => []),
  } as unknown as ProfileConfigManager;
}

describe('getConfigOrThrow', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses SLACK_CLI_TOKEN without reading the config file when no profile is given', async () => {
    vi.stubEnv('SLACK_CLI_TOKEN', '  xoxp-from-env  ');
    const manager = fakeManager('xoxp-from-file');

    await expect(getConfigOrThrow(undefined, manager)).resolves.toEqual({ token: 'xoxp-from-env' });
    expect(manager.getConfig).not.toHaveBeenCalled();
  });

  it('prefers the explicit profile over SLACK_CLI_TOKEN', async () => {
    vi.stubEnv('SLACK_CLI_TOKEN', 'xoxp-from-env');
    const manager = fakeManager('xoxp-from-file');

    await expect(getConfigOrThrow('work', manager)).resolves.toMatchObject({
      token: 'xoxp-from-file',
    });
    expect(manager.getConfig).toHaveBeenCalledWith('work');
  });

  it('falls back to the config file when SLACK_CLI_TOKEN is empty', async () => {
    vi.stubEnv('SLACK_CLI_TOKEN', '   ');
    const manager = fakeManager('xoxp-from-file');

    await expect(getConfigOrThrow(undefined, manager)).resolves.toMatchObject({
      token: 'xoxp-from-file',
    });
  });

  it('throws when neither SLACK_CLI_TOKEN nor a config exists', async () => {
    vi.stubEnv('SLACK_CLI_TOKEN', '');
    await expect(getConfigOrThrow(undefined, fakeManager(null))).rejects.toThrow();
  });
});
