import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreMocks, setupMockConsole } from './test-utils';

const mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
const mockGetCurrentProfile = vi.fn().mockResolvedValue('default');

vi.mock('../src/utils/update-notifier', () => ({
  checkForUpdates: mockCheckForUpdates,
}));

vi.mock('../src/utils/profile-config', () => ({
  ProfileConfigManager: vi.fn().mockImplementation(function () {
    return {
      getCurrentProfile: mockGetCurrentProfile,
      getConfig: vi.fn(),
      setToken: vi.fn(),
      listProfiles: vi.fn(),
      useProfile: vi.fn(),
      clearConfig: vi.fn(),
      maskToken: vi.fn((token: string) => token),
    };
  }),
}));

describe('index update notifier integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMockConsole();
  });

  afterEach(() => {
    restoreMocks();
  });

  it('does not run update check for --version', async () => {
    const { createProgram } = await import('../src/index');
    const program = createProgram();
    program.exitOverride();

    await expect(program.parseAsync(['node', 'slack-cli', '--version'])).rejects.toMatchObject({
      code: 'commander.version',
    });

    expect(mockCheckForUpdates).not.toHaveBeenCalled();
  });

  it('runs update check after a normal command action', async () => {
    const { createProgram } = await import('../src/index');
    const program = createProgram();

    await program.parseAsync(['node', 'slack-cli', 'config', 'current']);

    expect(mockGetCurrentProfile).toHaveBeenCalledTimes(1);
    expect(mockCheckForUpdates).toHaveBeenCalledWith({
      packageName: '@urugus/slack-cli',
      currentVersion: '0.20.5',
    });
  });
});
