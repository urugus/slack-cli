import { BaseSlackClient } from './base-client';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { Channel, ChannelDetail, ListChannelsOptions, Message } from '../slack-api-client';
import { WebClient } from '@slack/web-api';

export interface ChannelMembersOptions {
  limit?: number;
  cursor?: string;
}

export interface ChannelMembersResult {
  members: string[];
  nextCursor: string;
}

interface ChannelWithUnreadInfo extends Channel {
  unread_count: number;
  unread_count_display: number;
  last_read?: string;
}

export class ChannelOperations extends BaseSlackClient {
  constructor(tokenOrClient: string | WebClient) {
    if (typeof tokenOrClient === 'string') {
      super(tokenOrClient);
    } else {
      super('dummy-token'); // Call parent constructor
      this.client = tokenOrClient; // Override the client for testing
    }
  }

  async listChannels(options: ListChannelsOptions): Promise<Channel[]> {
    const channels: Channel[] = [];
    let cursor: string | undefined;

    // Paginate through all channels
    do {
      const response = await this.client.conversations.list({
        types: options.types,
        exclude_archived: options.exclude_archived,
        limit: options.limit,
        cursor,
      });

      if (response.channels) {
        channels.push(...(response.channels as Channel[]));
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  async listUnreadChannels(): Promise<Channel[]> {
    // Use users.conversations instead of conversations.list to only fetch
    // channels the current user is a member of, reducing API calls significantly
    const channels = await this.fetchUserChannels();
    const channelsWithUnread: Channel[] = [];

    // Process channels one by one with delay to avoid rate limits
    for (const channel of channels) {
      try {
        const unreadInfo = await this.getChannelUnreadInfo(channel);
        if (unreadInfo) {
          channelsWithUnread.push(unreadInfo);
        }

        // Add delay between API calls to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        // Skip channels that fail
        await this.handleRateLimit(error);
      }
    }

    return channelsWithUnread;
  }

  /**
   * Fetch channels the current user is a member of using users.conversations API.
   * This is more efficient than conversations.list for unread discovery since
   * unread messages only exist in channels the user has joined.
   * Supports pagination via next_cursor.
   */
  async fetchUserChannels(): Promise<Channel[]> {
    const channels: Channel[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.users.conversations({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      if (response.channels) {
        channels.push(...(response.channels as Channel[]));
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  private async getChannelUnreadInfo(channel: Channel): Promise<Channel | null> {
    const channelInfo = await this.fetchChannelInfo(channel.id);
    const unreadCount = await this.calculateUnreadCount(channel.id, channelInfo);

    if (unreadCount > 0) {
      return {
        ...channel,
        unread_count: unreadCount,
        unread_count_display: unreadCount,
        last_read: channelInfo.last_read,
      };
    }

    return null;
  }

  private async fetchChannelInfo(channelId: string): Promise<ChannelWithUnreadInfo> {
    const info = await this.client.conversations.info({
      channel: channelId,
      include_num_members: false,
    });
    return info.channel as ChannelWithUnreadInfo;
  }

  private async calculateUnreadCount(
    channelId: string,
    channelInfo: ChannelWithUnreadInfo
  ): Promise<number> {
    // Get the latest message to check if channel has any messages
    const latestMessage = await this.fetchLatestMessage(channelId);
    if (!latestMessage) {
      return 0;
    }

    if (channelInfo.last_read) {
      return await this.fetchUnreadMessageCount(channelId, channelInfo.last_read);
    } else {
      // If no last_read, all messages are unread
      return await this.fetchAllMessageCount(channelId);
    }
  }

  private async fetchLatestMessage(channelId: string): Promise<Message | null> {
    const history = await this.client.conversations.history({
      channel: channelId,
      limit: 1,
    });
    return history.messages && history.messages.length > 0
      ? (history.messages[0] as Message)
      : null;
  }

  private async fetchUnreadMessageCount(channelId: string, lastRead: string): Promise<number> {
    const unreadHistory = await this.client.conversations.history({
      channel: channelId,
      oldest: lastRead,
      limit: 100, // Get up to 100 unread messages
    });
    return unreadHistory.messages?.length || 0;
  }

  private async fetchAllMessageCount(channelId: string): Promise<number> {
    const allHistory = await this.client.conversations.history({
      channel: channelId,
      limit: 100,
    });
    return allHistory.messages?.length || 0;
  }

  async getChannelInfo(channelNameOrId: string): Promise<ChannelWithUnreadInfo> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    const info = await this.client.conversations.info({
      channel: channelId,
    });

    return info.channel as ChannelWithUnreadInfo;
  }

  async getChannelDetail(channelNameOrId: string): Promise<ChannelDetail> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    const info = await this.client.conversations.info({
      channel: channelId,
      include_num_members: true,
    });

    return info.channel as ChannelDetail;
  }

  async setTopic(channelNameOrId: string, topic: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.conversations.setTopic({
      channel: channelId,
      topic,
    });
  }

  async setPurpose(channelNameOrId: string, purpose: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.conversations.setPurpose({
      channel: channelId,
      purpose,
    });
  }

  async joinChannel(channelNameOrId: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.conversations.join({
      channel: channelId,
    });
  }

  async leaveChannel(channelNameOrId: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.conversations.leave({
      channel: channelId,
    });
  }

  async inviteToChannel(
    channelNameOrId: string,
    userIds: string[],
    force?: boolean
  ): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.conversations.invite({
      channel: channelId,
      users: userIds.join(','),
      ...(force && { force }),
    });
  }

  async getChannelMembers(
    channelNameOrId: string,
    options: ChannelMembersOptions = {}
  ): Promise<ChannelMembersResult> {
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    const response = await this.client.conversations.members({
      channel: channelId,
      limit: options.limit ?? 100,
      cursor: options.cursor,
    });

    return {
      members: (response.members as string[]) || [],
      nextCursor: response.response_metadata?.next_cursor || '',
    };
  }
}
