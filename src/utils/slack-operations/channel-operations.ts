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

        // Get the latest message in the channel
        const history = await this.client.conversations.history({
          channel: channel.id,
          limit: 1,
        });

        if (history.messages && history.messages.length > 0) {
          let hasUnread = false;
          let unreadCount = 0;

          if (!channelInfo.last_read) {
            // If last_read is empty, all messages are unread
            hasUnread = true;
            // Get total message count (up to 100)
            const allHistory = await this.client.conversations.history({
              channel: channel.id,
              limit: 100,
            });
            unreadCount = allHistory.messages?.length || 0;
          } else {
            // Check if there are messages after last_read
            const latestMessage = history.messages[0];
            const lastReadTs = parseFloat(channelInfo.last_read!);
            const latestMessageTs = parseFloat(latestMessage.ts || '0');

            if (latestMessageTs > lastReadTs) {
              hasUnread = true;
              // Calculate unread count by fetching messages after last_read
              const unreadHistory = await this.client.conversations.history({
                channel: channel.id,
                oldest: channelInfo.last_read,
                limit: 100, // Get up to 100 unread messages
              });
              unreadCount = unreadHistory.messages?.length || 0;
            }
          }

          if (hasUnread) {
            channelsWithUnread.push({
              ...channel,
              unread_count: unreadCount,
              unread_count_display: unreadCount,
              last_read: channelInfo.last_read,
            });
          }
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
