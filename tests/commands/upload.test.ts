import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupUploadCommand } from '../../src/commands/upload';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { setupMockConsole, createTestProgram, restoreMocks } from '../test-utils';
import * as fs from 'fs/promises';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');
vi.mock('fs/promises');

describe('upload command', () => {
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
    program.addCommand(setupUploadCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('upload file', () => {
    it('should upload a file to channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(mockSlackClient.uploadFile).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/path/to/file.txt',
      ]);

      expect(mockSlackClient.uploadFile).toHaveBeenCalledWith({
        channel: 'general',
        filePath: '/path/to/file.txt',
        title: undefined,
        initialComment: undefined,
        snippetType: undefined,
        threadTs: undefined,
        filename: undefined,
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('File uploaded successfully to #general')
      );
    });

    it('should upload with all options', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(mockSlackClient.uploadFile).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/path/to/report.csv',
        '--title',
        'Daily Report',
        '-m',
        'Here is the report',
        '--filetype',
        'csv',
        '-t',
        '1234567890.123456',
      ]);

      expect(mockSlackClient.uploadFile).toHaveBeenCalledWith({
        channel: 'general',
        filePath: '/path/to/report.csv',
        title: 'Daily Report',
        initialComment: 'Here is the report',
        snippetType: 'csv',
        threadTs: '1234567890.123456',
        filename: undefined,
      });
    });

    it('should upload content from stdin', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.uploadFile).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '--content',
        'console.log("hello")',
        '--filename',
        'snippet.js',
      ]);

      expect(mockSlackClient.uploadFile).toHaveBeenCalledWith({
        channel: 'general',
        content: 'console.log("hello")',
        title: undefined,
        initialComment: undefined,
        snippetType: undefined,
        threadTs: undefined,
        filename: 'snippet.js',
      });
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(mockSlackClient.uploadFile).mockResolvedValue();

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/path/to/file.txt',
        '--profile',
        'work',
      ]);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('validation', () => {
    it('should fail when neither file nor content is provided', async () => {
      const uploadCommand = setupUploadCommand();
      uploadCommand.exitOverride();

      await expect(
        uploadCommand.parseAsync(['-c', 'general'], { from: 'user' })
      ).rejects.toThrow('You must specify either --file or --content');
    });

    it('should fail when both file and content are provided', async () => {
      const uploadCommand = setupUploadCommand();
      uploadCommand.exitOverride();

      await expect(
        uploadCommand.parseAsync(
          ['-c', 'general', '-f', 'file.txt', '--content', 'text'],
          { from: 'user' }
        )
      ).rejects.toThrow('Cannot use both --file and --content');
    });

    it('should fail when thread timestamp is invalid', async () => {
      const uploadCommand = setupUploadCommand();
      uploadCommand.exitOverride();

      await expect(
        uploadCommand.parseAsync(
          ['-c', 'general', '-f', 'file.txt', '-t', 'invalid-ts'],
          { from: 'user' }
        )
      ).rejects.toThrow('Invalid thread timestamp format');
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/path/to/file.txt',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle file not found', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/nonexistent/file.txt',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(mockSlackClient.uploadFile).mockRejectedValue(
        new Error('not_allowed_token_type')
      );

      await program.parseAsync([
        'node',
        'slack-cli',
        'upload',
        '-c',
        'general',
        '-f',
        '/path/to/file.txt',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
