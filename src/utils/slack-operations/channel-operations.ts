import { WebClient } from '@slack/web-api';
import pLimit from 'p-limit';
import type {
  Channel,
  ChannelDetail,
  ChannelMembersOptions,
  ChannelMembersResult,
  ListChannelsOptions,
} from '../../types/slack';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS, RATE_LIMIT } from '../constants';
import { sanitizeTerminalText } from '../terminal-sanitizer';
import { BaseSlackClient, SlackClientDependency } from './base-client';

interface ChannelWithUnreadInfo extends Channel {
  unread_count: number;
  unread_count_display: number;
  last_read?: string;
}

export class ChannelOperations extends BaseSlackClient {
  private channelLookupCache?: Promise<Channel[]>;

  constructor(tokenOrClient: SlackClientDependency) {
    super(tokenOrClient as string | WebClient);
  }

  async listChannels(options: ListChannelsOptions): Promise<Channel[]> {
    const channels: Channel[] = [];
    let cursor: string | undefined;

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
    const channels = await this.fetchUserChannels();
    const unreadScanLimiter = pLimit(RATE_LIMIT.UNREAD_SCAN_CONCURRENT_REQUESTS);
    const unreadChannels = await Promise.all(
      channels.map((channel) =>
        unreadScanLimiter(async () => {
          try {
            return await this.getChannelUnreadInfo(channel);
          } catch (error) {
            await this.handleRateLimit(error);
            return null;
          }
        })
      )
    );

    return unreadChannels.filter((channel): channel is Channel => channel !== null);
  }

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

  async enrichUnreadChannels(channels: Channel[]): Promise<Channel[]> {
    const unreadScanLimiter = pLimit(RATE_LIMIT.UNREAD_SCAN_CONCURRENT_REQUESTS);

    const enrichedChannels = await Promise.all(
      channels.map((channel) =>
        unreadScanLimiter(async () => {
          try {
            const channelInfo = await this.fetchChannelInfo(channel.id);
            return await this.buildUnreadChannel(
              channel,
              channelInfo,
              channel.unread_count_display ?? channel.unread_count ?? 0
            );
          } catch (error) {
            await this.handleRateLimit(error);
            return channel;
          }
        })
      )
    );

    return enrichedChannels;
  }

  async resolveChannelId(channelNameOrId: string): Promise<string> {
    return channelResolver.resolveChannelId(channelNameOrId, async () =>
      this.getChannelLookupCache()
    );
  }

  private getChannelLookupCache(): Promise<Channel[]> {
    if (!this.channelLookupCache) {
      this.channelLookupCache = this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      }).catch((error) => {
        this.channelLookupCache = undefined;
        throw error;
      });
    }

    return this.channelLookupCache;
  }

  private async getChannelUnreadInfo(channel: Channel): Promise<Channel | null> {
    const hasUnreadCount =
      channel.unread_count !== undefined || channel.unread_count_display !== undefined;
    const needsChannelInfo =
      !hasUnreadCount || (!channel.name && !channel.is_im && !channel.is_mpim);
    const channelInfo = needsChannelInfo ? await this.fetchChannelInfo(channel.id) : undefined;
    const unreadCount =
      channel.unread_count_display ??
      channel.unread_count ??
      channelInfo?.unread_count_display ??
      channelInfo?.unread_count ??
      0;

    if (unreadCount > 0) {
      return this.buildUnreadChannel(channel, channelInfo, unreadCount);
    }

    return null;
  }

  private async fetchChannelInfo(channelId: string): Promise<ChannelWithUnreadInfo> {
    for (let attempt = 0; ; attempt++) {
      try {
        const info = await this.client.conversations.info({
          channel: channelId,
          include_num_members: false,
        });
        return info.channel as ChannelWithUnreadInfo;
      } catch (error) {
        const isRateLimitError = error instanceof Error && error.message?.includes('rate limit');
        if (!isRateLimitError || attempt >= RATE_LIMIT.RETRY_CONFIG.retries) {
          throw error;
        }

        await this.handleRateLimit(error);
      }
    }
  }

  private async resolveChannelDisplayName(
    channel: ChannelWithUnreadInfo
  ): Promise<string | undefined> {
    const conversationName = channel.name;
    if (conversationName && conversationName !== channel.id) {
      return undefined;
    }

    if (channel.is_im && channel.user) {
      try {
        const response = await this.client.users.info({ user: channel.user });
        const user = response.user as { name?: string; profile?: { display_name?: string } };
        const username = user.profile?.display_name || user.name || channel.user;
        return sanitizeTerminalText(`@${username}`);
      } catch {
        return sanitizeTerminalText(`@${channel.user}`);
      }
    }

    if (channel.is_mpim) {
      const purpose = channel.purpose?.value?.trim();
      if (purpose) {
        return sanitizeTerminalText(purpose);
      }
    }

    return sanitizeTerminalText(channel.id);
  }

  private async buildUnreadChannel(
    channel: Channel,
    channelInfo?: ChannelWithUnreadInfo,
    unreadCount = 0
  ): Promise<Channel> {
    const mergedChannel: ChannelWithUnreadInfo = {
      ...channelInfo,
      ...channel,
      unread_count: unreadCount,
      unread_count_display: unreadCount,
      last_read: channel.last_read ?? channelInfo?.last_read,
    };
    const name = mergedChannel.name || channelInfo?.id || channel.id;
    const display_name = mergedChannel.display_name
      ? sanitizeTerminalText(mergedChannel.display_name)
      : await this.resolveChannelDisplayName(mergedChannel);

    return {
      ...mergedChannel,
      name,
      display_name,
    };
  }

  async getChannelInfo(channelNameOrId: string): Promise<ChannelWithUnreadInfo> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    const info = await this.client.conversations.info({
      channel: channelId,
    });

    return info.channel as ChannelWithUnreadInfo;
  }

  async getChannelDetail(channelNameOrId: string): Promise<ChannelDetail> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    const info = await this.client.conversations.info({
      channel: channelId,
      include_num_members: true,
    });

    return info.channel as ChannelDetail;
  }

  async setTopic(channelNameOrId: string, topic: string): Promise<void> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    await this.client.conversations.setTopic({
      channel: channelId,
      topic,
    });
  }

  async setPurpose(channelNameOrId: string, purpose: string): Promise<void> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    await this.client.conversations.setPurpose({
      channel: channelId,
      purpose,
    });
  }

  async joinChannel(channelNameOrId: string): Promise<void> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    await this.client.conversations.join({
      channel: channelId,
    });
  }

  async leaveChannel(channelNameOrId: string): Promise<void> {
    const channelId = await this.resolveChannelId(channelNameOrId);

    await this.client.conversations.leave({
      channel: channelId,
    });
  }

  async inviteToChannel(
    channelNameOrId: string,
    userIds: string[],
    force?: boolean
  ): Promise<void> {
    const channelId = await this.resolveChannelId(channelNameOrId);

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
    const channelId = await this.resolveChannelId(channelNameOrId);

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
