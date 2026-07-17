import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageWriteOperations } from '../../../src/utils/slack-operations/message-write-operations';

vi.mock('@slack/web-api', () => ({
  LogLevel: { ERROR: 'error' },
  WebClient: vi.fn().mockImplementation(function () {
    return {
      chat: {
        delete: vi.fn(),
        deleteScheduledMessage: vi.fn(),
        postEphemeral: vi.fn(),
        postMessage: vi.fn(),
        scheduleMessage: vi.fn(),
        scheduledMessages: {
          list: vi.fn(),
        },
        update: vi.fn(),
      },
    };
  }),
}));

describe('MessageWriteOperations', () => {
  type MockClient = {
    chat: {
      delete: ReturnType<typeof vi.fn>;
      deleteScheduledMessage: ReturnType<typeof vi.fn>;
      postEphemeral: ReturnType<typeof vi.fn>;
      postMessage: ReturnType<typeof vi.fn>;
      scheduleMessage: ReturnType<typeof vi.fn>;
      scheduledMessages: {
        list: ReturnType<typeof vi.fn>;
      };
      update: ReturnType<typeof vi.fn>;
    };
  };

  let messageOps: MessageWriteOperations;
  let mockClient: MockClient;
  let channelOps: { resolveChannelId: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    channelOps = { resolveChannelId: vi.fn().mockResolvedValue('C1234567890') };
    messageOps = new MessageWriteOperations('test-token', channelOps as never);
    mockClient = (messageOps as unknown as { client: MockClient }).client;
  });

  it('sends regular and threaded messages', async () => {
    mockClient.chat.postMessage.mockResolvedValue({ ok: true, ts: '1.2' });

    await expect(messageOps.sendMessage('C1', 'hello')).resolves.toEqual({ ok: true, ts: '1.2' });
    expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'hello',
    });

    await messageOps.sendMessage('C1', 'reply', '1.2');
    expect(mockClient.chat.postMessage).toHaveBeenLastCalledWith({
      channel: 'C1',
      text: 'reply',
      thread_ts: '1.2',
    });
  });

  it('sends Block Kit messages', async () => {
    const blocks = [{ type: 'divider' }];
    mockClient.chat.postMessage.mockResolvedValue({ ok: true, ts: '1.2' });

    await expect(messageOps.sendMessage('C1', 'fallback', undefined, blocks)).resolves.toEqual({
      ok: true,
      ts: '1.2',
    });
    expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'fallback',
      blocks,
    });

    await messageOps.sendMessage('C1', undefined, '1.2', blocks);
    expect(mockClient.chat.postMessage).toHaveBeenLastCalledWith({
      channel: 'C1',
      blocks,
      thread_ts: '1.2',
    });
  });

  it('sends regular and threaded ephemeral messages', async () => {
    mockClient.chat.postEphemeral.mockResolvedValue({ ok: true });

    await messageOps.sendEphemeralMessage('C1', 'U1', 'hello');
    expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
      channel: 'C1',
      user: 'U1',
      text: 'hello',
    });

    await messageOps.sendEphemeralMessage('C1', 'U1', 'reply', '1.2');
    expect(mockClient.chat.postEphemeral).toHaveBeenLastCalledWith({
      channel: 'C1',
      user: 'U1',
      text: 'reply',
      thread_ts: '1.2',
    });
  });

  it('schedules regular and threaded messages', async () => {
    mockClient.chat.scheduleMessage.mockResolvedValue({ ok: true, scheduled_message_id: 'Q1' });

    await messageOps.scheduleMessage('C1', 'later', 123);
    expect(mockClient.chat.scheduleMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'later',
      post_at: 123,
    });

    await messageOps.scheduleMessage('C1', 'thread later', 123, '1.2');
    expect(mockClient.chat.scheduleMessage).toHaveBeenLastCalledWith({
      channel: 'C1',
      text: 'thread later',
      post_at: 123,
      thread_ts: '1.2',
    });
  });

  it('schedules Block Kit messages', async () => {
    const blocks = [{ type: 'divider' }];
    mockClient.chat.scheduleMessage.mockResolvedValue({ ok: true, scheduled_message_id: 'Q1' });

    await messageOps.scheduleMessage('C1', undefined, 123, undefined, blocks);

    expect(mockClient.chat.scheduleMessage).toHaveBeenCalledWith({
      channel: 'C1',
      post_at: 123,
      blocks,
    });
  });

  it('lists scheduled messages with and without a channel filter', async () => {
    mockClient.chat.scheduledMessages.list.mockResolvedValueOnce({
      scheduled_messages: [{ id: 'Q1' }],
    });

    await expect(messageOps.listScheduledMessages(undefined, 20)).resolves.toEqual([{ id: 'Q1' }]);
    expect(mockClient.chat.scheduledMessages.list).toHaveBeenCalledWith({ limit: 20 });

    mockClient.chat.scheduledMessages.list.mockResolvedValueOnce({});

    await expect(messageOps.listScheduledMessages('general')).resolves.toEqual([]);
    expect(channelOps.resolveChannelId).toHaveBeenCalledWith('general');
    expect(mockClient.chat.scheduledMessages.list).toHaveBeenLastCalledWith({
      limit: 50,
      channel: 'C1234567890',
    });
  });

  it('resolves channel names before mutating existing messages', async () => {
    mockClient.chat.update.mockResolvedValue({ ok: true, ts: '1.2' });

    await expect(messageOps.updateMessage('general', '1.2', 'updated')).resolves.toEqual({
      ok: true,
      ts: '1.2',
    });
    expect(mockClient.chat.update).toHaveBeenCalledWith({
      channel: 'C1234567890',
      ts: '1.2',
      text: 'updated',
    });

    await messageOps.deleteMessage('general', '1.2');
    expect(mockClient.chat.delete).toHaveBeenCalledWith({
      channel: 'C1234567890',
      ts: '1.2',
    });

    await messageOps.cancelScheduledMessage('general', 'Q1');
    expect(mockClient.chat.deleteScheduledMessage).toHaveBeenCalledWith({
      channel: 'C1234567890',
      scheduled_message_id: 'Q1',
    });
  });
});
