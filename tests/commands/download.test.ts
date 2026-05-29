import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupDownloadCommand } from '../../src/commands/download';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import type { ThreadFile } from '../../src/utils/slack-operations/file-operations';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

const sampleFiles: ThreadFile[] = [
  {
    id: 'F001',
    name: 'SKILL.md',
    title: 'masterplan-coach',
    filetype: 'markdown',
    size: 1234,
    mode: 'snippet',
    url_private_download: 'https://files.slack.com/files-pri/T1-F001/download/skill.md',
  },
  {
    id: 'F002',
    name: 'mp_variable_dictionary.yaml',
    filetype: 'yaml',
    size: 567,
    mode: 'hosted',
    url_private_download: 'https://files.slack.com/files-pri/T1-F002/download/dict.yaml',
  },
];

describe('download command', () => {
  let program: ReturnType<typeof createTestProgram>;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let mockConsole: ReturnType<typeof setupMockConsole>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockImplementation(function () {
      return mockConfigManager;
    });

    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockImplementation(function () {
      return mockSlackClient;
    });

    mockConsole = setupMockConsole();
    program = createTestProgram();
    program.addCommand(setupDownloadCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('downloading files', () => {
    it('should download every file attached to a thread', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue(sampleFiles);
      vi.mocked(mockSlackClient.downloadFile).mockImplementation(async (file) => ({
        id: file.id,
        name: file.name as string,
        path: `/out/${file.name}`,
        size: file.size ?? 0,
        contentType: 'application/octet-stream',
      }));

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
        '-o',
        '/out',
      ]);

      expect(mockSlackClient.listThreadFiles).toHaveBeenCalledWith('general', '1778642820.183399', {
        messageTs: undefined,
      });
      expect(mockSlackClient.downloadFile).toHaveBeenCalledTimes(2);
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Downloaded 2/2'));
    });

    it('should narrow downloads to a single message with --ts', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue([sampleFiles[0]]);
      vi.mocked(mockSlackClient.downloadFile).mockResolvedValue({
        id: 'F001',
        name: 'SKILL.md',
        path: '/out/SKILL.md',
        size: 1234,
        contentType: 'text/markdown',
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
        '--ts',
        '1779967716.201649',
      ]);

      expect(mockSlackClient.listThreadFiles).toHaveBeenCalledWith('general', '1778642820.183399', {
        messageTs: '1779967716.201649',
      });
      expect(mockSlackClient.downloadFile).toHaveBeenCalledTimes(1);
    });

    it('should report a partial download when one file fails', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue(sampleFiles);
      vi.mocked(mockSlackClient.downloadFile)
        .mockResolvedValueOnce({
          id: 'F001',
          name: 'SKILL.md',
          path: '/out/SKILL.md',
          size: 1234,
          contentType: 'text/markdown',
        })
        .mockRejectedValueOnce(new Error('HTTP 403 Forbidden'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipped mp_variable_dictionary.yaml')
      );
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('Downloaded 1/2'));
      // Partial failure must exit non-zero so scripts/CI can detect it.
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should report when no files are found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
      ]);

      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('No files found'));
      expect(mockSlackClient.downloadFile).not.toHaveBeenCalled();
    });

    it('should use the specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue([]);

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('--list', () => {
    it('should list files without downloading', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue(sampleFiles);

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
        '--list',
      ]);

      expect(mockSlackClient.downloadFile).not.toHaveBeenCalled();
      expect(mockConsole.logSpy).toHaveBeenCalledWith(expect.stringContaining('SKILL.md'));
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('mp_variable_dictionary.yaml')
      );
    });

    it('should list files as JSON', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.listThreadFiles).mockResolvedValue(sampleFiles);

      await program.parseAsync([
        'node',
        'slack-cli',
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
        '--list',
        '--format',
        'json',
      ]);

      expect(mockSlackClient.downloadFile).not.toHaveBeenCalled();
      const jsonOutput = mockConsole.logSpy.mock.calls
        .map((call) => String(call[0]))
        .find((output) => output.includes('F001'));
      expect(jsonOutput).toBeDefined();
      expect(JSON.parse(jsonOutput as string)).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('should fail when thread timestamp is invalid', async () => {
      const downloadCommand = setupDownloadCommand();
      downloadCommand.exitOverride();

      await expect(
        downloadCommand.parseAsync(['-c', 'general', '-t', 'invalid-ts'], { from: 'user' })
      ).rejects.toThrow('Invalid thread timestamp format');
    });

    it('should fail when --ts is invalid', async () => {
      const downloadCommand = setupDownloadCommand();
      downloadCommand.exitOverride();

      await expect(
        downloadCommand.parseAsync(['-c', 'general', '-t', '1778642820.183399', '--ts', 'nope'], {
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
        'download',
        '-c',
        'general',
        '-t',
        '1778642820.183399',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
