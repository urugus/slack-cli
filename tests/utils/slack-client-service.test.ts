import { WebClient } from '@slack/web-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackApiClient, slackApiClient } from '../../src/utils/slack-client-service';

vi.mock('@slack/web-api', () => ({
  LogLevel: { ERROR: 'ERROR' },
  WebClient: vi.fn(),
}));

function mockWebClient(instance: unknown) {
  vi.mocked(WebClient).mockImplementation(
    class {
      constructor() {
        return instance;
      }
    } as never
  );
}

function createClientWithOps() {
  const client = new SlackApiClient('test-token') as SlackApiClient & Record<string, unknown>;
  const ops = {
    assistantOps: {
      clearThreadStatus: vi.fn().mockResolvedValue('clearThreadStatus-result'),
      setThreadStatus: vi.fn().mockResolvedValue('setThreadStatus-result'),
    },
    canvasOps: {
      listCanvases: vi.fn().mockResolvedValue('listCanvases-result'),
      readCanvas: vi.fn().mockResolvedValue('readCanvas-result'),
      writeCanvas: vi.fn().mockResolvedValue('writeCanvas-result'),
    },
    channelOps: {
      enrichUnreadChannels: vi.fn().mockResolvedValue('enrichedUnreadChannels-result'),
      getChannelDetail: vi.fn().mockResolvedValue('getChannelDetail-result'),
      getChannelMembers: vi.fn().mockResolvedValue('getChannelMembers-result'),
      inviteToChannel: vi.fn().mockResolvedValue('inviteToChannel-result'),
      joinChannel: vi.fn().mockResolvedValue('joinChannel-result'),
      leaveChannel: vi.fn().mockResolvedValue('leaveChannel-result'),
      listChannels: vi.fn().mockResolvedValue('listChannels-result'),
      listUnreadChannels: vi.fn().mockResolvedValue('fallbackUnreadChannels-result'),
      setPurpose: vi.fn().mockResolvedValue('setPurpose-result'),
      setTopic: vi.fn().mockResolvedValue('setTopic-result'),
    },
    fileOps: {
      downloadFile: vi.fn().mockResolvedValue('downloadFile-result'),
      uploadFile: vi.fn().mockResolvedValue('uploadFile-result'),
    },
    messageOps: {
      cancelScheduledMessage: vi.fn().mockResolvedValue('cancelScheduledMessage-result'),
      deleteMessage: vi.fn().mockResolvedValue('deleteMessage-result'),
      getChannelUnread: vi.fn().mockResolvedValue('getChannelUnread-result'),
      getHistory: vi.fn().mockResolvedValue('getHistory-result'),
      getMessage: vi.fn().mockResolvedValue('getMessage-result'),
      getMessageWithUsers: vi.fn().mockResolvedValue('getMessageWithUsers-result'),
      getPermalink: vi.fn().mockResolvedValue('getPermalink-result'),
      getPermalinks: vi.fn().mockResolvedValue('getPermalinks-result'),
      getThreadHistory: vi.fn().mockResolvedValue('getThreadHistory-result'),
      listScheduledMessages: vi.fn().mockResolvedValue('listScheduledMessages-result'),
      markAsRead: vi.fn().mockResolvedValue('markAsRead-result'),
      scheduleMessage: vi.fn().mockResolvedValue('scheduleMessage-result'),
      sendEphemeralMessage: vi.fn().mockResolvedValue('sendEphemeralMessage-result'),
      sendMessage: vi.fn().mockResolvedValue('sendMessage-result'),
      updateMessage: vi.fn().mockResolvedValue('updateMessage-result'),
    },
    pinOps: {
      addPin: vi.fn().mockResolvedValue('addPin-result'),
      listPins: vi.fn().mockResolvedValue('listPins-result'),
      removePin: vi.fn().mockResolvedValue('removePin-result'),
    },
    reactionOps: {
      addReaction: vi.fn().mockResolvedValue('addReaction-result'),
      removeReaction: vi.fn().mockResolvedValue('removeReaction-result'),
    },
    reminderOps: {
      addReminder: vi.fn().mockResolvedValue('addReminder-result'),
      completeReminder: vi.fn().mockResolvedValue('completeReminder-result'),
      deleteReminder: vi.fn().mockResolvedValue('deleteReminder-result'),
      listReminders: vi.fn().mockResolvedValue('listReminders-result'),
    },
    searchOps: {
      listUnreadChannels: vi.fn().mockResolvedValue(['unread-channel']),
      searchMessages: vi.fn().mockResolvedValue('searchMessages-result'),
    },
    starOps: {
      addStar: vi.fn().mockResolvedValue('addStar-result'),
      listStars: vi.fn().mockResolvedValue('listStars-result'),
      removeStar: vi.fn().mockResolvedValue('removeStar-result'),
    },
    userOps: {
      getPresence: vi.fn().mockResolvedValue('getPresence-result'),
      getUserInfo: vi.fn().mockResolvedValue('getUserInfo-result'),
      listUsers: vi.fn().mockResolvedValue('listUsers-result'),
      lookupByEmail: vi.fn().mockResolvedValue('lookupByEmail-result'),
      openDmChannel: vi.fn().mockResolvedValue('openDmChannel-result'),
      resolveUserIdByName: vi.fn().mockResolvedValue('resolveUserIdByName-result'),
    },
  };

  Object.assign(client, ops);
  return { client, ops };
}

describe('SlackApiClient service facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebClient({
      conversations: {
        list: vi.fn().mockResolvedValue({ channels: [] }),
      },
    });
  });

  it('delegates message operations', async () => {
    const { client, ops } = createClientWithOps();
    const blocks = [{ type: 'divider' }];

    await expect(client.sendMessage('C1', 'hello', '1.2')).resolves.toBe('sendMessage-result');
    expect(ops.messageOps.sendMessage).toHaveBeenCalledWith('C1', 'hello', '1.2', undefined);

    await expect(client.sendMessage('C1', undefined, undefined, blocks)).resolves.toBe(
      'sendMessage-result'
    );
    expect(ops.messageOps.sendMessage).toHaveBeenCalledWith('C1', undefined, undefined, blocks);

    await expect(client.sendEphemeralMessage('C1', 'U1', 'hello', '1.2')).resolves.toBe(
      'sendEphemeralMessage-result'
    );
    expect(ops.messageOps.sendEphemeralMessage).toHaveBeenCalledWith('C1', 'U1', 'hello', '1.2');

    await expect(client.scheduleMessage('C1', 'later', 123, '1.2')).resolves.toBe(
      'scheduleMessage-result'
    );
    expect(ops.messageOps.scheduleMessage).toHaveBeenCalledWith(
      'C1',
      'later',
      123,
      '1.2',
      undefined
    );

    await expect(client.scheduleMessage('C1', undefined, 123, undefined, blocks)).resolves.toBe(
      'scheduleMessage-result'
    );
    expect(ops.messageOps.scheduleMessage).toHaveBeenCalledWith(
      'C1',
      undefined,
      123,
      undefined,
      blocks
    );

    await expect(client.updateMessage('C1', '1.2', 'updated')).resolves.toBe(
      'updateMessage-result'
    );
    expect(ops.messageOps.updateMessage).toHaveBeenCalledWith('C1', '1.2', 'updated');

    await expect(client.deleteMessage('C1', '1.2')).resolves.toBe('deleteMessage-result');
    expect(ops.messageOps.deleteMessage).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.listScheduledMessages('C1', 10)).resolves.toBe(
      'listScheduledMessages-result'
    );
    expect(ops.messageOps.listScheduledMessages).toHaveBeenCalledWith('C1', 10);

    await expect(client.cancelScheduledMessage('C1', 'Q1')).resolves.toBe(
      'cancelScheduledMessage-result'
    );
    expect(ops.messageOps.cancelScheduledMessage).toHaveBeenCalledWith('C1', 'Q1');
  });

  it('delegates history, unread, and permalink operations', async () => {
    const { client, ops } = createClientWithOps();
    const options = { limit: 5 };

    await expect(client.getHistory('C1', options)).resolves.toBe('getHistory-result');
    expect(ops.messageOps.getHistory).toHaveBeenCalledWith('C1', options);

    await expect(client.getThreadHistory('C1', '1.2')).resolves.toBe('getThreadHistory-result');
    expect(ops.messageOps.getThreadHistory).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.getMessage('C1', '2.3', '1.2')).resolves.toBe('getMessage-result');
    expect(ops.messageOps.getMessage).toHaveBeenCalledWith('C1', '2.3', '1.2');

    await expect(client.getMessageWithUsers('C1', '2.3', '1.2')).resolves.toBe(
      'getMessageWithUsers-result'
    );
    expect(ops.messageOps.getMessageWithUsers).toHaveBeenCalledWith('C1', '2.3', '1.2');

    await expect(client.getChannelUnread('general')).resolves.toBe('getChannelUnread-result');
    expect(ops.messageOps.getChannelUnread).toHaveBeenCalledWith('general');

    await expect(client.markAsRead('C1')).resolves.toBe('markAsRead-result');
    expect(ops.messageOps.markAsRead).toHaveBeenCalledWith('C1');

    await expect(client.getPermalink('C1', '1.2')).resolves.toBe('getPermalink-result');
    expect(ops.messageOps.getPermalink).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.getPermalinks('C1', ['1.2', '2.3'])).resolves.toBe('getPermalinks-result');
    expect(ops.messageOps.getPermalinks).toHaveBeenCalledWith('C1', ['1.2', '2.3']);
  });

  it('delegates channel operations and unread enrichment', async () => {
    const { client, ops } = createClientWithOps();
    const listOptions = { types: 'public_channel', limit: 20 };
    const memberOptions = { limit: 10 };

    await expect(client.listChannels(listOptions)).resolves.toBe('listChannels-result');
    expect(ops.channelOps.listChannels).toHaveBeenCalledWith(listOptions);

    await expect(client.getChannelDetail('general')).resolves.toBe('getChannelDetail-result');
    expect(ops.channelOps.getChannelDetail).toHaveBeenCalledWith('general');

    await expect(client.setTopic('general', 'topic')).resolves.toBe('setTopic-result');
    expect(ops.channelOps.setTopic).toHaveBeenCalledWith('general', 'topic');

    await expect(client.setPurpose('general', 'purpose')).resolves.toBe('setPurpose-result');
    expect(ops.channelOps.setPurpose).toHaveBeenCalledWith('general', 'purpose');

    await expect(client.listUnreadChannels()).resolves.toBe('enrichedUnreadChannels-result');
    expect(ops.searchOps.listUnreadChannels).toHaveBeenCalledWith();
    expect(ops.channelOps.enrichUnreadChannels).toHaveBeenCalledWith(['unread-channel']);

    await expect(client.joinChannel('general')).resolves.toBe('joinChannel-result');
    expect(ops.channelOps.joinChannel).toHaveBeenCalledWith('general');

    await expect(client.leaveChannel('general')).resolves.toBe('leaveChannel-result');
    expect(ops.channelOps.leaveChannel).toHaveBeenCalledWith('general');

    await expect(client.inviteToChannel('general', ['U1'], true)).resolves.toBe(
      'inviteToChannel-result'
    );
    expect(ops.channelOps.inviteToChannel).toHaveBeenCalledWith('general', ['U1'], true);

    await expect(client.getChannelMembers('general', memberOptions)).resolves.toBe(
      'getChannelMembers-result'
    );
    expect(ops.channelOps.getChannelMembers).toHaveBeenCalledWith('general', memberOptions);
  });

  it('delegates file, reaction, pin, user, search, reminder, star, canvas, and assistant operations', async () => {
    const { client, ops } = createClientWithOps();

    await expect(client.uploadFile({ channels: ['C1'], file: 'a.txt' })).resolves.toBe(
      'uploadFile-result'
    );
    expect(ops.fileOps.uploadFile).toHaveBeenCalledWith({ channels: ['C1'], file: 'a.txt' });

    await expect(client.downloadFile({ url: 'https://example.com/file' })).resolves.toBe(
      'downloadFile-result'
    );
    expect(ops.fileOps.downloadFile).toHaveBeenCalledWith({ url: 'https://example.com/file' });

    await expect(client.addReaction('C1', '1.2', 'thumbsup')).resolves.toBe('addReaction-result');
    expect(ops.reactionOps.addReaction).toHaveBeenCalledWith('C1', '1.2', 'thumbsup');

    await expect(client.removeReaction('C1', '1.2', 'thumbsup')).resolves.toBe(
      'removeReaction-result'
    );
    expect(ops.reactionOps.removeReaction).toHaveBeenCalledWith('C1', '1.2', 'thumbsup');

    await expect(client.addPin('C1', '1.2')).resolves.toBe('addPin-result');
    expect(ops.pinOps.addPin).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.removePin('C1', '1.2')).resolves.toBe('removePin-result');
    expect(ops.pinOps.removePin).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.listPins('C1')).resolves.toBe('listPins-result');
    expect(ops.pinOps.listPins).toHaveBeenCalledWith('C1');

    await expect(client.listUsers(20)).resolves.toBe('listUsers-result');
    expect(ops.userOps.listUsers).toHaveBeenCalledWith(20);

    await expect(client.getUserInfo('U1')).resolves.toBe('getUserInfo-result');
    expect(ops.userOps.getUserInfo).toHaveBeenCalledWith('U1');

    await expect(client.lookupUserByEmail('a@example.com')).resolves.toBe('lookupByEmail-result');
    expect(ops.userOps.lookupByEmail).toHaveBeenCalledWith('a@example.com');

    await expect(client.openDmChannel('U1')).resolves.toBe('openDmChannel-result');
    expect(ops.userOps.openDmChannel).toHaveBeenCalledWith('U1');

    await expect(client.getUserPresence('U1')).resolves.toBe('getPresence-result');
    expect(ops.userOps.getPresence).toHaveBeenCalledWith('U1');

    await expect(client.resolveUserIdByName('alice')).resolves.toBe('resolveUserIdByName-result');
    expect(ops.userOps.resolveUserIdByName).toHaveBeenCalledWith('alice');

    await expect(client.searchMessages('hello', { count: 5 })).resolves.toBe(
      'searchMessages-result'
    );
    expect(ops.searchOps.searchMessages).toHaveBeenCalledWith('hello', { count: 5 });

    await expect(client.addReminder('standup', 123)).resolves.toBe('addReminder-result');
    expect(ops.reminderOps.addReminder).toHaveBeenCalledWith('standup', 123);

    await expect(client.listReminders()).resolves.toBe('listReminders-result');
    expect(ops.reminderOps.listReminders).toHaveBeenCalledWith();

    await expect(client.deleteReminder('R1')).resolves.toBe('deleteReminder-result');
    expect(ops.reminderOps.deleteReminder).toHaveBeenCalledWith('R1');

    await expect(client.completeReminder('R1')).resolves.toBe('completeReminder-result');
    expect(ops.reminderOps.completeReminder).toHaveBeenCalledWith('R1');

    await expect(client.addStar('C1', '1.2')).resolves.toBe('addStar-result');
    expect(ops.starOps.addStar).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.listStars(10)).resolves.toBe('listStars-result');
    expect(ops.starOps.listStars).toHaveBeenCalledWith(10);

    await expect(client.removeStar('C1', '1.2')).resolves.toBe('removeStar-result');
    expect(ops.starOps.removeStar).toHaveBeenCalledWith('C1', '1.2');

    await expect(client.readCanvas('F1')).resolves.toBe('readCanvas-result');
    expect(ops.canvasOps.readCanvas).toHaveBeenCalledWith('F1');

    await expect(client.listCanvases('C1')).resolves.toBe('listCanvases-result');
    expect(ops.canvasOps.listCanvases).toHaveBeenCalledWith('C1');

    await expect(client.writeCanvas('F1', 'body', 'end')).resolves.toBe('writeCanvas-result');
    expect(ops.canvasOps.writeCanvas).toHaveBeenCalledWith('F1', 'body', 'end');

    await expect(
      client.setAssistantThreadStatus({
        channel: 'C1',
        threadTs: '1.2',
        status: 'working',
      })
    ).resolves.toBe('setThreadStatus-result');
    expect(ops.assistantOps.setThreadStatus).toHaveBeenCalledWith({
      channel: 'C1',
      threadTs: '1.2',
      status: 'working',
    });

    await expect(client.clearAssistantThreadStatus('C1', '1.2')).resolves.toBe(
      'clearThreadStatus-result'
    );
    expect(ops.assistantOps.clearThreadStatus).toHaveBeenCalledWith('C1', '1.2');
  });

  it('keeps the legacy listChannels helper as a token-based adapter', async () => {
    const conversationsList = vi.fn().mockResolvedValue({
      channels: [{ id: 'C1', name: 'general' }],
      response_metadata: { next_cursor: '' },
    });
    mockWebClient({
      conversations: { list: conversationsList },
    });

    await expect(
      slackApiClient.listChannels('token', {
        types: 'public_channel',
        exclude_archived: true,
        limit: 100,
      })
    ).resolves.toEqual([{ id: 'C1', name: 'general' }]);

    expect(WebClient).toHaveBeenCalledWith('token', expect.any(Object));
    expect(conversationsList).toHaveBeenCalledWith({
      types: 'public_channel',
      exclude_archived: true,
      limit: 100,
    });
  });
});
