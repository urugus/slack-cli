import { WebClient } from '@slack/web-api';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { Channel, ChannelDetail, ListChannelsOptions } from '../slack-api-client';
import { BaseSlackClient, SlackClientDependency } from './base-client';

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
  constructor(tokenOrClient: SlackClientDependency) {
    super(tokenOrClient as string | WebClient);
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
    const unreadCount = channelInfo.unread_count_display ?? channelInfo.unread_count ?? 0;

    if (unreadCount > 0) {
      const display_name = await this.resolveChannelDisplayName(channel, channelInfo);
      return {
        ...channelInfo,
        ...channel,
        name: channelInfo.name || channel.name,
        display_name,
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

  private async resolveChannelDisplayName(
    channel: Channel,
    channelInfo: ChannelWithUnreadInfo
  ): Promise<string | undefined> {
    const conversationName = channelInfo.name || channel.name;
    if (conversationName) {
      return undefined;
    }

    if (channelInfo.is_im && channelInfo.user) {
      try {
        const response = await this.client.users.info({ user: channelInfo.user });
        const user = response.user as { name?: string; profile?: { display_name?: string } };
        const username = user.profile?.display_name || user.name || channelInfo.user;
        return `@${username}`;
      } catch {
        return `@${channelInfo.user}`;
      }
    }

    if (channelInfo.is_mpim) {
      const purpose = channelInfo.purpose?.value?.trim();
      if (purpose) {
        return purpose;
      }
    }

    return channelInfo.id;
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
