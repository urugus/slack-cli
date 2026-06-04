import * as fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import { FileOperations } from '../../../src/utils/slack-operations/file-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      files: {
        info: vi.fn(),
        uploadV2: vi.fn(),
      },
      conversations: {
        history: vi.fn(),
        replies: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');
vi.mock('fs/promises');

describe('FileOperations', () => {
  type MockClient = {
    files: {
      info: ReturnType<typeof vi.fn>;
      uploadV2: ReturnType<typeof vi.fn>;
    };
    conversations: {
      history: ReturnType<typeof vi.fn>;
      replies: ReturnType<typeof vi.fn>;
    };
  };

  let fileOps: FileOperations;
  let mockClient: MockClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from('file-bytes'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    fileOps = new FileOperations('test-token');
    mockClient = (fileOps as unknown as { client: MockClient }).client;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  describe('downloadFile', () => {
    it('should download by file id', async () => {
      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123',
          name: 'image.png',
          url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
        },
      });

      const result = await fileOps.downloadFile({
        fileId: 'F123',
        outputDir: '/tmp',
      });

      expect(mockClient.files.info).toHaveBeenCalledWith({ file: 'F123' });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://files.slack.com/files-pri/T123-F123/image.png',
        {
          headers: { Authorization: 'Bearer test-token' },
          redirect: 'manual',
        }
      );
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/image.png', Buffer.from('file-bytes'), {
        flag: 'wx',
      });
      expect(result).toEqual({
        file: {
          id: 'F123',
          name: 'image.png',
          url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
        },
        path: '/tmp/image.png',
        bytes: 10,
      });
    });

    it('should download a file attached to a thread message', async () => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');
      mockClient.conversations.replies.mockResolvedValue({
        messages: [
          {
            type: 'message',
            ts: '1780530261.218279',
            files: [
              {
                id: 'F123',
                name: 'image.png',
                url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
              },
            ],
          },
        ],
      });

      await fileOps.downloadFile({
        channel: 'general',
        messageTs: '1780530261.218279',
        threadTs: '1780527015.228619',
        outputPath: '/tmp/custom.png',
      });

      expect(channelResolver.resolveChannelId).toHaveBeenCalledWith(
        'general',
        expect.any(Function)
      );
      expect(mockClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C123456789',
        ts: '1780527015.228619',
        cursor: undefined,
      });
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/custom.png', Buffer.from('file-bytes'), {
        flag: 'wx',
      });
    });

    it('should allow overwrite when force is true', async () => {
      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123',
          name: 'image.png',
          url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
        },
      });

      await fileOps.downloadFile({
        fileId: 'F123',
        outputPath: '/tmp/image.png',
        force: true,
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/image.png', Buffer.from('file-bytes'));
    });

    it('should show a clear error when the output file already exists', async () => {
      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123',
          name: 'image.png',
          url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
        },
      });
      vi.mocked(fs.writeFile).mockRejectedValueOnce(
        Object.assign(new Error('exists'), {
          code: 'EEXIST',
        })
      );

      await expect(
        fileOps.downloadFile({
          fileId: 'F123',
          outputPath: '/tmp/image.png',
        })
      ).rejects.toThrow('Output file already exists: /tmp/image.png');
    });

    it('should reject HTML responses', async () => {
      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123',
          name: 'image.png',
          url_private_download: 'https://files.slack.com/files-pri/T123-F123/image.png',
        },
      });
      fetchMock.mockResolvedValueOnce(
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );

      await expect(fileOps.downloadFile({ fileId: 'F123' })).rejects.toThrow(
        'Slack returned HTML instead of the file'
      );
    });
  });
});
