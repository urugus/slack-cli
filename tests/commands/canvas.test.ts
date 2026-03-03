import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupCanvasCommand } from '../../src/commands/canvas';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('canvas command', () => {
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
    program.addCommand(setupCanvasCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('read subcommand', () => {
    it('should read canvas sections by canvas ID', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.readCanvas).mockResolvedValue([
        { id: 'section1' },
        { id: 'section2' },
      ]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'F0AJ4852CQN',
      ]);

      expect(mockSlackClient.readCanvas).toHaveBeenCalledWith('F0AJ4852CQN');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should output sections in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.readCanvas).mockResolvedValue([
        { id: 'section1' },
      ]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'F0AJ4852CQN',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = JSON.parse(mockConsole.logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(1);
      expect(output[0].id).toBe('section1');
    });

    it('should show message when no sections found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.readCanvas).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'F0AJ4852CQN',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No sections found in canvas');
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.readCanvas).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'F0AJ4852CQN',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should handle canvas_not_found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.readCanvas).mockRejectedValue(
        new Error('canvas_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'invalid-id',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'read',
        '-i',
        'F0AJ4852CQN',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('list subcommand', () => {
    it('should list canvases for a channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listCanvases).mockResolvedValue([
        {
          id: 'F0AJ4852CQN',
          name: 'Incident Report',
          created: 1700000000,
          filetype: 'quip',
        },
      ]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'general',
      ]);

      expect(mockSlackClient.listCanvases).toHaveBeenCalledWith('general');
      expect(mockConsole.logSpy).toHaveBeenCalled();
    });

    it('should output canvases in json format', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listCanvases).mockResolvedValue([
        {
          id: 'F0AJ4852CQN',
          name: 'Incident Report',
          created: 1700000000,
          filetype: 'quip',
        },
      ]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'general',
        '--format',
        'json',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalled();
      const output = JSON.parse(mockConsole.logSpy.mock.calls[0][0]);
      expect(output).toHaveLength(1);
      expect(output[0].id).toBe('F0AJ4852CQN');
    });

    it('should show message when no canvases found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listCanvases).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'general',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith('No canvases found in channel');
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listCanvases).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'general',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });

    it('should handle channel_not_found error', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listCanvases).mockRejectedValue(
        new Error('channel_not_found')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'nonexistent',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'canvas',
        'list',
        '-c',
        'general',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
