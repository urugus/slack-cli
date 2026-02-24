import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupPinCommand } from '../../src/commands/pin';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('pin command', () => {
  let program: any;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    } as any);

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    } as any);

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupPinCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('add subcommand', () => {
    it('should add a pin to a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addPin).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.addPin).toHaveBeenCalledWith('general', '1234567890.123456');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pin added to message in #general')
      );
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addPin).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('remove subcommand', () => {
    it('should remove a pin from a message', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.removePin).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'remove',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.removePin).toHaveBeenCalledWith('general', '1234567890.123456');
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pin removed from message in #general')
      );
    });
  });

  describe('list subcommand', () => {
    it('should list pinned items in table format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listPins).mockResolvedValue([
        {
          type: 'message',
          created: 1700000000,
          created_by: 'U123',
          message: {
            text: 'Pinned message 1',
            user: 'U123',
            ts: '1234567890.123456',
          },
        },
      ]);

      await program.parseAsync(['node', 'slack-cli', 'pin', 'list', '-c', 'general']);

      expect(mockSlackClient.listPins).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should output in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      const pins = [
        {
          type: 'message',
          created: 1700000000,
          created_by: 'U123',
          message: {
            text: 'Pinned message',
            user: 'U123',
            ts: '1234567890.123456',
          },
        },
      ];
      vi.mocked(mockSlackClient.listPins).mockResolvedValue(pins);

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'list',
        '-c',
        'general',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(JSON.stringify(pins, null, 2));
    });

    it('should output in simple format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listPins).mockResolvedValue([
        {
          type: 'message',
          created: 1700000000,
          created_by: 'U123',
          message: {
            text: 'Pinned message',
            user: 'U123',
            ts: '1234567890.123456',
          },
        },
      ]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'list',
        '-c',
        'general',
        '--format',
        'simple',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pinned message')
      );
    });

    it('should show message when no pins found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listPins).mockResolvedValue([]);

      await program.parseAsync(['node', 'slack-cli', 'pin', 'list', '-c', 'general']);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No pinned items found');
    });

    it('should use specified profile for list', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listPins).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'list',
        '-c',
        'general',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('validation', () => {
    it('should fail when timestamp format is invalid for add', async () => {
      const pinCommand = setupPinCommand();
      pinCommand.exitOverride();

      const addCommand = pinCommand.commands.find((c: any) => c.name() === 'add')!;
      addCommand.exitOverride();

      await expect(
        addCommand.parseAsync(['-c', 'general', '-t', 'invalid-ts'], {
          from: 'user',
        })
      ).rejects.toThrow('Invalid thread timestamp format');
    });

    it('should fail when timestamp format is invalid for remove', async () => {
      const pinCommand = setupPinCommand();
      pinCommand.exitOverride();

      const removeCommand = pinCommand.commands.find((c: any) => c.name() === 'remove')!;
      removeCommand.exitOverride();

      await expect(
        removeCommand.parseAsync(['-c', 'general', '-t', 'invalid-ts'], {
          from: 'user',
        })
      ).rejects.toThrow('Invalid thread timestamp format');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle already_pinned error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.addPin).mockRejectedValue(new Error('already_pinned'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'add',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle no_pin error on remove', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.removePin).mockRejectedValue(new Error('no_pin'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'pin',
        'remove',
        '-c',
        'general',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
