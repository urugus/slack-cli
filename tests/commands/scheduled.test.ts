import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupScheduledCommand } from '../../src/commands/scheduled';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('scheduled command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;
  let tableSpy: any;

  const mockScheduledMessages = [
    {
      id: 'Q123',
      channel_id: 'C1234567890',
      post_at: 1770855000,
      date_created: 1770854400,
      text: 'Scheduled message 1',
    },
    {
      id: 'Q456',
      channel_id: 'C0987654321',
      post_at: 1770858600,
      date_created: 1770854400,
      text: 'Scheduled message 2',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockReturnValue(mockSlackClient);

    mockConsole = setupMockConsole();
    tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

    program = createTestProgram();
    program.addCommand(setupScheduledCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  it('should list scheduled messages in table format by default', async () => {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
      mockScheduledMessages as any
    );

    await program.parseAsync(['node', 'slack-cli', 'scheduled']);

    expect(mockSlackClient.listScheduledMessages).toHaveBeenCalledWith(undefined, 50);
    expect(tableSpy).toHaveBeenCalled();
  });

  it('should filter by channel and limit', async () => {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
      mockScheduledMessages as any
    );

    await program.parseAsync([
      'node',
      'slack-cli',
      'scheduled',
      '--channel',
      'general',
      '--limit',
      '10',
    ]);

    expect(mockSlackClient.listScheduledMessages).toHaveBeenCalledWith('general', 10);
  });

  it('should output json format', async () => {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
      mockScheduledMessages as any
    );

    await program.parseAsync(['node', 'slack-cli', 'scheduled', '--format', 'json']);

    expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('"id": "Q123"'));
  });

  it('should output simple format', async () => {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue(
      mockScheduledMessages as any
    );

    await program.parseAsync(['node', 'slack-cli', 'scheduled', '--format', 'simple']);

    expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Q123'));
    expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Q456'));
  });

  it('should show empty message when no scheduled messages', async () => {
    vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
      token: 'test-token',
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(mockSlackClient.listScheduledMessages).mockResolvedValue([] as any);

    await program.parseAsync(['node', 'slack-cli', 'scheduled']);

    expect(mockConsole.logSpy).toHaveBeenCalledWith('No scheduled messages found');
  });
});
