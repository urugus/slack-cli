import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import {
  FileOperations,
  type ThreadFile,
} from '../../../src/utils/slack-operations/file-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      files: {
        uploadV2: vi.fn(),
      },
      conversations: {
        replies: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

vi.mock('../../../src/utils/channel-resolver');

function webStreamFrom(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function mockFetchResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  body?: string | null;
}): Response {
  const { ok = true, status = 200, statusText = 'OK', contentType = 'text/plain' } = options;
  const body = options.body === undefined ? 'file-contents' : options.body;
  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    body: body === null ? null : webStreamFrom(body),
  } as unknown as Response;
}

describe('FileOperations', () => {
  type MockClient = {
    files: {
      uploadV2: ReturnType<typeof vi.fn>;
    };
    conversations: {
      replies: ReturnType<typeof vi.fn>;
    };
  };

  let fileOps: FileOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('listThreadFiles', () => {
    beforeEach(() => {
      vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C123456789');
    });

    it('should collect files across paginated replies', async () => {
      mockClient.conversations.replies
        .mockResolvedValueOnce({
          messages: [{ ts: '1.1', files: [{ id: 'F1', name: 'a.txt' }] }],
          response_metadata: { next_cursor: 'CURSOR2' },
        })
        .mockResolvedValueOnce({
          messages: [{ ts: '2.2', files: [{ id: 'F2', name: 'b.txt' }] }],
          response_metadata: { next_cursor: '' },
        });

      const files = await fileOps.listThreadFiles('general', '1.1');

      expect(files.map((f) => f.id)).toEqual(['F1', 'F2']);
      expect(mockClient.conversations.replies).toHaveBeenCalledTimes(2);
      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123456789', ts: '1.1', limit: 200 })
      );
    });

    it('should narrow to a single message when messageTs is given', async () => {
      mockClient.conversations.replies.mockResolvedValue({
        messages: [
          { ts: '1.1', files: [{ id: 'F1', name: 'a.txt' }] },
          { ts: '2.2', files: [{ id: 'F2', name: 'b.txt' }] },
        ],
        response_metadata: { next_cursor: '' },
      });

      const files = await fileOps.listThreadFiles('general', '1.1', { messageTs: '2.2' });

      expect(files.map((f) => f.id)).toEqual(['F2']);
    });

    it('should return empty array when no files are attached', async () => {
      mockClient.conversations.replies.mockResolvedValue({
        messages: [{ ts: '1.1' }],
        response_metadata: { next_cursor: '' },
      });

      const files = await fileOps.listThreadFiles('general', '1.1');

      expect(files).toEqual([]);
    });
  });

  describe('downloadFile', () => {
    let outDir: string;

    const baseFile: ThreadFile = {
      id: 'F100',
      name: 'report.csv',
      filetype: 'csv',
      url_private_download: 'https://files.slack.com/files-pri/T1-F100/download/report.csv',
    };

    beforeEach(async () => {
      outDir = await mkdtemp(join(tmpdir(), 'slack-cli-dl-'));
    });

    afterEach(async () => {
      await rm(outDir, { recursive: true, force: true });
    });

    it('should download a file to disk', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse({ body: 'col1,col2\n1,2\n' }))
      );

      const result = await fileOps.downloadFile(baseFile, outDir);

      expect(result.name).toBe('report.csv');
      expect(result.size).toBe('col1,col2\n1,2\n'.length);
      const written = await readFile(join(outDir, 'report.csv'), 'utf-8');
      expect(written).toBe('col1,col2\n1,2\n');
    });

    it('should send the bearer token in the Authorization header', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ body: 'x' }));
      vi.stubGlobal('fetch', fetchMock);

      await fileOps.downloadFile(baseFile, outDir);

      expect(fetchMock).toHaveBeenCalledWith(
        baseFile.url_private_download,
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
    });

    it('should sanitize path-traversal file names to the file id', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ body: 'x' })));

      const result = await fileOps.downloadFile({ ...baseFile, name: '../../evil.sh' }, outDir);

      // basename strips the path, leaving "evil.sh"; never escapes outDir.
      expect(result.path.startsWith(outDir)).toBe(true);
      expect(result.name).toBe('evil.sh');
    });

    it('should fall back to file id when the name is a separator-only path', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ body: 'x' })));

      const result = await fileOps.downloadFile({ ...baseFile, name: '/' }, outDir);

      expect(result.name).toBe('F100');
    });

    it('should deconflict duplicate file names with the file id', async () => {
      // Return a fresh response (and stream) per call so the body is never reused.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => mockFetchResponse({ body: 'x' }))
      );

      const first = await fileOps.downloadFile(baseFile, outDir);
      const second = await fileOps.downloadFile({ ...baseFile, id: 'F200' }, outDir);

      expect(first.name).toBe('report.csv');
      expect(second.name).toBe('report-F200.csv');
    });

    it('should throw when the file has no downloadable URL', async () => {
      await expect(
        fileOps.downloadFile({ id: 'F1', name: 'x', mode: 'external', is_external: true }, outDir)
      ).rejects.toThrow('no downloadable URL');
    });

    it('should reject an HTML login page returned for an inaccessible file', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse({ contentType: 'text/html', body: '<html>' }))
      );

      await expect(fileOps.downloadFile(baseFile, outDir)).rejects.toThrow(
        'HTML page instead of file data'
      );
    });

    it('should throw on a non-OK HTTP response', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' }))
      );

      await expect(fileOps.downloadFile(baseFile, outDir)).rejects.toThrow('HTTP 403 Forbidden');
    });
  });
});
