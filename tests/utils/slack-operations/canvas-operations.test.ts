import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasOperations } from '../../../src/utils/slack-operations/canvas-operations';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function () {
    return {
      canvases: {
        edit: vi.fn(),
        sections: {
          lookup: vi.fn(),
        },
      },
      files: {
        list: vi.fn(),
      },
    };
  }),
  LogLevel: {
    ERROR: 'error',
  },
}));

describe('CanvasOperations', () => {
  type MockClient = {
    canvases: {
      edit: ReturnType<typeof vi.fn>;
      sections: {
        lookup: ReturnType<typeof vi.fn>;
      };
    };
  };

  let canvasOps: CanvasOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    canvasOps = new CanvasOperations('test-token');
    mockClient = (canvasOps as unknown as { client: MockClient }).client;
  });

  describe('writeCanvas', () => {
    it('should append markdown to the end by default', async () => {
      mockClient.canvases.edit.mockResolvedValue({ ok: true });

      await canvasOps.writeCanvas('F0AJ4852CQN', '追記する内容', 'end');

      expect(mockClient.canvases.edit).toHaveBeenCalledWith({
        canvas_id: 'F0AJ4852CQN',
        changes: [
          {
            operation: 'insert_at_end',
            document_content: {
              type: 'markdown',
              markdown: '追記する内容',
            },
          },
        ],
      });
    });

    it('should insert markdown at the start', async () => {
      mockClient.canvases.edit.mockResolvedValue({ ok: true });

      await canvasOps.writeCanvas('F0AJ4852CQN', '先頭に追加', 'start');

      expect(mockClient.canvases.edit).toHaveBeenCalledWith({
        canvas_id: 'F0AJ4852CQN',
        changes: [
          {
            operation: 'insert_at_start',
            document_content: {
              type: 'markdown',
              markdown: '先頭に追加',
            },
          },
        ],
      });
    });

    it('should replace the whole canvas', async () => {
      mockClient.canvases.edit.mockResolvedValue({ ok: true });

      await canvasOps.writeCanvas('F0AJ4852CQN', '全体を置換', 'replace');

      expect(mockClient.canvases.edit).toHaveBeenCalledWith({
        canvas_id: 'F0AJ4852CQN',
        changes: [
          {
            operation: 'replace',
            document_content: {
              type: 'markdown',
              markdown: '全体を置換',
            },
          },
        ],
      });
    });

    it('should pass markdown through without sanitizing terminal escape sequences', async () => {
      mockClient.canvases.edit.mockResolvedValue({ ok: true });
      const markdown = '# Title\n\u001b[31mkeep raw markdown\u001b[0m';

      await canvasOps.writeCanvas('F0AJ4852CQN', markdown, 'end');

      expect(mockClient.canvases.edit).toHaveBeenCalledWith({
        canvas_id: 'F0AJ4852CQN',
        changes: [
          {
            operation: 'insert_at_end',
            document_content: {
              type: 'markdown',
              markdown,
            },
          },
        ],
      });
    });

    it('should throw when edit fails', async () => {
      mockClient.canvases.edit.mockRejectedValue(new Error('canvas_not_found'));

      await expect(canvasOps.writeCanvas('invalid-id', '追記する内容', 'end')).rejects.toThrow(
        'canvas_not_found'
      );
    });
  });
});
