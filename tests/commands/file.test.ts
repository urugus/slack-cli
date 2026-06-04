import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupFileCommand } from '../../src/commands/file';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { createTestProgram, restoreMocks, setupMockConsole } from '../test-utils';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');

describe('file command', () => {
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
    program.addCommand(setupFileCommand());
  });

  afterEach(() => {
    restoreMocks();
  });

  describe('download', () => {
    it('should download from a Slack message URL', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.downloadFile).mockResolvedValue({
        file: { id: 'F123', name: 'image.png' },
        path: '/tmp/image.png',
        bytes: 1234,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '--url',
        'https://example.slack.com/archives/C123/p1780530261218279?thread_ts=1780527015.228619',
        '--dir',
        '/tmp',
      ]);

      expect(mockSlackClient.downloadFile).toHaveBeenCalledWith({
        fileId: undefined,
        channel: 'C123',
        messageTs: '1780530261.218279',
        threadTs: '1780527015.228619',
        fileIndex: 1,
        outputPath: undefined,
        outputDir: '/tmp',
      });
      expect(mockConsole.logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Downloaded image.png to /tmp/image.png')
      );
    });

    it('should download by file id', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.downloadFile).mockResolvedValue({
        file: { id: 'F123', name: 'image.png' },
        path: 'image.png',
        bytes: 1234,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '--id',
        'F123',
        '--output',
        'image.png',
      ]);

      expect(mockSlackClient.downloadFile).toHaveBeenCalledWith({
        fileId: 'F123',
        channel: undefined,
        messageTs: undefined,
        threadTs: undefined,
        fileIndex: 1,
        outputPath: 'image.png',
        outputDir: undefined,
      });
    });

    it('should download from channel and message timestamp', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(mockSlackClient.downloadFile).mockResolvedValue({
        file: { id: 'F123', name: 'image.png' },
        path: 'image.png',
        bytes: 1234,
      });

      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '-c',
        'C123',
        '-t',
        '1780530261.218279',
        '--thread',
        '1780527015.228619',
        '--index',
        '2',
      ]);

      expect(mockSlackClient.downloadFile).toHaveBeenCalledWith({
        fileId: undefined,
        channel: 'C123',
        messageTs: '1780530261.218279',
        threadTs: '1780527015.228619',
        fileIndex: 2,
        outputPath: undefined,
        outputDir: '.',
      });
    });
  });

  describe('validation', () => {
    it('should fail when multiple sources are specified', async () => {
      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '--id',
        'F123',
        '--url',
        'https://example.com',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('Specify exactly one source')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when channel is missing timestamp', async () => {
      await program.parseAsync(['node', 'slack-cli', 'file', 'download', '-c', 'C123']);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('--channel and --timestamp must be specified together')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when index is invalid', async () => {
      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '--id',
        'F123',
        '--index',
        '0',
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('--index must be a positive integer')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });

    it.each([
      '1.5',
      '2abc',
    ])('should fail when index is not an integer string: %s', async (index) => {
      await program.parseAsync([
        'node',
        'slack-cli',
        'file',
        'download',
        '--id',
        'F123',
        '--index',
        index,
      ]);

      expect(mockConsole.errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('--index must be a positive integer')
      );
      expect(mockConsole.exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
