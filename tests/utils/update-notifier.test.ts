import * as fs from 'fs/promises';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdates } from '../../src/utils/update-notifier';

vi.mock('fs/promises');
vi.mock('os');

describe('update notifier', () => {
  const originalCI = process.env.CI;
  const originalDisableFlag = process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER;
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/test-user');
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(process.stderr, 'isTTY', {
      configurable: true,
      value: true,
    });
    delete process.env.CI;
    delete process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER;
  });

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }

    if (originalDisableFlag === undefined) {
      delete process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER;
    } else {
      process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER = originalDisableFlag;
    }

    if (originalIsTTY) {
      Object.defineProperty(process.stderr, 'isTTY', originalIsTTY);
    }
  });

  it('fresh cache hit when newer version exists', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        latestVersion: '1.2.0',
        lastCheckedAt: new Date().toISOString(),
      })
    );

    const fetchImpl = vi.fn();

    await checkForUpdates({
      packageName: '@urugus/slack-cli',
      currentVersion: '1.0.0',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Update available: 1.0.0 -> 1.2.0')
    );
  });

  it('expired cache fetches latest version and writes cache', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        latestVersion: '1.0.1',
        lastCheckedAt: '2020-01-01T00:00:00.000Z',
      })
    );

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.3.0' }),
    });

    await checkForUpdates({
      packageName: '@urugus/slack-cli',
      currentVersion: '1.0.0',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40urugus%2Fslack-cli/latest',
      expect.objectContaining({
        headers: { accept: 'application/json' },
      })
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/home\/test-user\/\.slack-cli\/update-notifier\.json\.\d+\.\d+\.tmp$/),
      expect.stringContaining('"latestVersion": "1.3.0"'),
      expect.objectContaining({ mode: 0o600, flag: 'wx' })
    );
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringMatching(/^\/home\/test-user\/\.slack-cli\/update-notifier\.json\.\d+\.\d+\.tmp$/),
      '/home/test-user/.slack-cli/update-notifier.json'
    );
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('same version does not notify', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        latestVersion: '1.0.0',
        lastCheckedAt: new Date().toISOString(),
      })
    );

    await checkForUpdates({
      packageName: '@urugus/slack-cli',
      currentVersion: '1.0.0',
    });

    expect(console.error).not.toHaveBeenCalled();
  });

  it('network errors are swallowed', async () => {
    vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network failure'));

    await expect(
      checkForUpdates({
        packageName: '@urugus/slack-cli',
        currentVersion: '1.0.0',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();

    expect(console.error).not.toHaveBeenCalled();
  });

  it('CI environment skips update checks', async () => {
    process.env.CI = '1';
    const fetchImpl = vi.fn();

    await checkForUpdates({
      packageName: '@urugus/slack-cli',
      currentVersion: '1.0.0',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('disable flag skips update checks', async () => {
    process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER = '1';
    const fetchImpl = vi.fn();

    await checkForUpdates({
      packageName: '@urugus/slack-cli',
      currentVersion: '1.0.0',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});
