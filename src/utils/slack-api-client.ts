import { WebClient, ChatPostMessageResponse, LogLevel } from '@slack/web-api';
import pLimit from 'p-limit';
import { channelResolver } from './channel-resolver';
import { RATE_LIMIT, DEFAULTS } from './constants';

export interface Channel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private: boolean;
  created: number;
  is_archived?: boolean;
  is_general?: boolean;
  unlinked?: number;
  name_normalized?: string;
  is_shared?: boolean;
  is_ext_shared?: boolean;
  is_org_shared?: boolean;
  is_member?: boolean;
  num_members?: number;
  unread_count?: number;
  unread_count_display?: number;
  last_read?: string;
  topic?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
  purpose?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
}

// Extended channel interface with additional properties from API
interface ChannelWithUnreadInfo extends Channel {
  unread_count: number;
  unread_count_display: number;
  last_read?: string;
}

export interface ListChannelsOptions {
  types: string;
  exclude_archived: boolean;
  limit: number;
}

export interface HistoryOptions {
  limit: number;
  oldest?: string;
}

export interface Message {
  type: string;
  text?: string;
  user?: string;
  bot_id?: string;
  ts: string;
  thread_ts?: string;
  attachments?: unknown[];
  blocks?: unknown[];
}

export interface HistoryResult {
  messages: Message[];
  users: Map<string, string>;
}

export interface ChannelUnreadResult {
  channel: Channel;
  messages: Message[];
  users: Map<string, string>;
}

export class SlackApiClient {
  private client: WebClient;
  private rateLimiter: ReturnType<typeof pLimit>;

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: {
        retries: 0, // Disable automatic retries to handle rate limits manually
      },
      logLevel: LogLevel.ERROR, // Reduce noise from WebClient logs
    });
    // Limit concurrent API calls to avoid rate limiting
    this.rateLimiter = pLimit(RATE_LIMIT.CONCURRENT_REQUESTS);
  }

  async sendMessage(channel: string, text: string): Promise<ChatPostMessageResponse> {
    return await this.client.chat.postMessage({
      channel,
      text,
    });
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

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    // Resolve channel name to ID if needed
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.listChannels({
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
    const users = new Map<string, string>();

    // Fetch user information
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

    return { messages, users };
  }

  async listUnreadChannels(): Promise<Channel[]> {
    try {
      // Use users.conversations to get unread counts in a single API call
      const response = await this.client.users.conversations({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 1000,
        user: undefined, // Current authenticated user
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
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Skip channels that fail
        if (error instanceof Error && error.message?.includes('rate limit')) {
          // If we hit rate limit, wait longer
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    return channelsWithUnread;
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    // Resolve channel name to ID if needed
    const channelId = await channelResolver.resolveChannelId(channelNameOrId, () =>
      this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    // Get channel info with unread count
    const info = await this.client.conversations.info({
      channel: channelId,
    });
    const channel = info.channel as ChannelWithUnreadInfo;

    // Get unread messages
    let messages: Message[] = [];
    let users = new Map<string, string>();

    if (channel.last_read && channel.unread_count > 0) {
      const historyResult = await this.getHistory(channelId, {
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
}

export const slackApiClient = {
  listChannels: async (token: string, options: ListChannelsOptions): Promise<Channel[]> => {
    const client = new SlackApiClient(token);
    return client.listChannels(options);
  },
};
