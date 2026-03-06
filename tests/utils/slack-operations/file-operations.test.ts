import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import { FileOperations } from '../../../src/utils/slack-operations/file-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      files: {
        uploadV2: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

describe('FileOperations', () => {
  let fileOps: FileOperations;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fileOps = new FileOperations('test-token');
    mockClient = (fileOps as any).client;
  });

  describe('uploadFile', () => {
    it('should upload a file by path', async () => {
      mockClient.files.uploadV2.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await fileOps.uploadFile({
        channel: 'general',
        filePath: '/path/to/file.txt',
      });

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'C123456789',
        file: '/path/to/file.txt',
        filename: 'file.txt',
      });
    });

    it('should upload content as snippet', async () => {
      mockClient.files.uploadV2.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await fileOps.uploadFile({
        channel: 'general',
        content: 'console.log("hello")',
        filename: 'snippet.js',
      });

      expect(mockClient.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'C123456789',
        content: 'console.log("hello")',
        filename: 'snippet.js',
      });
    });

    it('should include optional parameters', async () => {
      mockClient.files.uploadV2.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await fileOps.uploadFile({
        channel: 'general',
        filePath: '/path/to/report.csv',
        title: 'Daily Report',
        initialComment: 'Here is the report',
        snippetType: 'csv',
        threadTs: '1234567890.123456',
      });

      expect(mockClient.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'C123456789',
        file: '/path/to/report.csv',
        filename: 'report.csv',
        title: 'Daily Report',
        initial_comment: 'Here is the report',
        snippet_type: 'csv',
        thread_ts: '1234567890.123456',
      });
    });

    it('should use provided filename over path basename', async () => {
      mockClient.files.uploadV2.mockResolvedValue({ ok: true });
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await fileOps.uploadFile({
        channel: 'general',
        filePath: '/path/to/file.txt',
        filename: 'custom-name.txt',
      });

      expect(mockClient.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'C123456789',
        file: '/path/to/file.txt',
        filename: 'custom-name.txt',
      });
    });

    it('should throw on API error', async () => {
      mockClient.files.uploadV2.mockRejectedValue(new Error('not_allowed_token_type'));
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');

      await expect(
        fileOps.uploadFile({
          channel: 'general',
          filePath: '/path/to/file.txt',
        })
      ).rejects.toThrow('not_allowed_token_type');
    });
  });
});
