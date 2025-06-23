import { ChatPostMessageResponse } from '@slack/web-api';
import { BaseSlackClient } from './base-client';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { Message, HistoryOptions, HistoryResult, ChannelUnreadResult } from '../slack-api-client';
import { ChannelOperations } from './channel-operations';
import { extractAllUserIds } from '../mention-utils';

export class MessageOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(token: string) {
    super(token);
    this.channelOps = new ChannelOperations(token);
  }

  async sendMessage(channel: string, text: string): Promise<ChatPostMessageResponse> {
    return await this.client.chat.postMessage({
      channel,
      text,
    });
  }

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    // Resolve channel name to ID if needed
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    const response = await this.client.conversations.history({
      channel: channelId,
      limit: options.limit,
      oldest: options.oldest,
    });

    const messages = response.messages as Message[];

    // Extract all unique user IDs (authors and mentioned users)
    const userIds = extractAllUserIds(messages);
    const users = await this.fetchUserInfo(userIds);

    return { messages, users };
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    const channel = await this.channelOps.getChannelInfo(channelNameOrId);

    // Get unread messages
    let messages: Message[] = [];
    let users = new Map<string, string>();
    let actualUnreadCount = 0;

    if (channel.last_read) {
      // Always fetch messages after last_read to get accurate unread count
      const historyResult = await this.getHistory(channel.id, {
        limit: 100, // Fetch up to 100 messages after last_read
        oldest: channel.last_read,
      });
      messages = historyResult.messages;
      users = historyResult.users;
      actualUnreadCount = messages.length;
    } else if (!channel.last_read) {
      // If no last_read, all messages are unread
      const historyResult = await this.getHistory(channel.id, {
        limit: 100,
      });
      messages = historyResult.messages;
      users = historyResult.users;
      actualUnreadCount = messages.length;
    }

    return {
      channel: {
        ...channel,
        unread_count: actualUnreadCount,
        unread_count_display: actualUnreadCount,
      },
      messages,
      users,
    };
  }

  private async fetchUserInfo(userIds: string[]): Promise<Map<string, string>> {
    const users = new Map<string, string>();

    if (userIds.length > 0) {
      for (const userId of userIds) {
        try {
          const userInfo = await this.client.users.info({ user: userId });
          if (userInfo.user?.name) {
            users.set(userId, userInfo.user.name);
          }
        } catch (error) {
          // If we can't get user info, we'll use the ID
          users.set(userId, userId);
        }
      }
    }

    return users;
  }
}
