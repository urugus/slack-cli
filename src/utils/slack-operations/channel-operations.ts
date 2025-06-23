import { BaseSlackClient } from './base-client';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { Channel, ListChannelsOptions } from '../slack-api-client';

interface ChannelWithUnreadInfo extends Channel {
  unread_count: number;
  unread_count_display: number;
  last_read?: string;
}

export class ChannelOperations extends BaseSlackClient {
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
    try {
      // Use users.conversations to get unread counts in a single API call
      const response = await this.client.users.conversations({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 1000,
      });

      const channels = response.channels as Channel[];

      // Filter to only channels with unread messages
      // The users.conversations endpoint includes unread_count_display
      return channels.filter((channel) => (channel.unread_count_display || 0) > 0);
    } catch (error) {
      // Fallback to the old method if users.conversations fails
      console.warn('Failed to use users.conversations, falling back to conversations.list');
      return this.listUnreadChannelsFallback();
    }
  }

  private async listUnreadChannelsFallback(): Promise<Channel[]> {
    // Get all conversations the user is a member of
    const response = await this.client.conversations.list({
      types: 'public_channel,private_channel,im,mpim',
      exclude_archived: true,
      limit: 1000,
    });

    const channels = response.channels as Channel[];
    const channelsWithUnread: Channel[] = [];

    // Process channels one by one with delay to avoid rate limits
    for (const channel of channels) {
      try {
        const info = await this.client.conversations.info({
          channel: channel.id,
          include_num_members: false,
        });
        const channelInfo = info.channel as ChannelWithUnreadInfo;

        if (channelInfo.unread_count_display && channelInfo.unread_count_display > 0) {
          channelsWithUnread.push({
            ...channel,
            unread_count: channelInfo.unread_count || 0,
            unread_count_display: channelInfo.unread_count_display || 0,
            last_read: channelInfo.last_read,
          });
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
}
