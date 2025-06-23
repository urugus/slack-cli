import { ChatPostMessageResponse } from '@slack/web-api';
import { BaseSlackClient } from './base-client';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { Message, HistoryOptions, HistoryResult, ChannelUnreadResult } from '../slack-api-client';
import { ChannelOperations } from './channel-operations';

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

    // Get unique user IDs
    const userIds = [...new Set(messages.filter((m) => m.user).map((m) => m.user!))];
    const users = await this.fetchUserInfo(userIds);

    return { messages, users };
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    const channel = await this.channelOps.getChannelInfo(channelNameOrId);

    // Get unread messages
    let messages: Message[] = [];
    let users = new Map<string, string>();

    if (channel.last_read && channel.unread_count > 0) {
      const historyResult = await this.getHistory(channel.id, {
        limit: channel.unread_count,
        oldest: channel.last_read,
      });
      messages = historyResult.messages;
      users = historyResult.users;
    }

    return {
      channel: {
        ...channel,
        unread_count: channel.unread_count || 0,
        unread_count_display: channel.unread_count_display || 0,
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
