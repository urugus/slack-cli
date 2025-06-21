import { WebClient, ChatPostMessageResponse } from '@slack/web-api';

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

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendMessage(channel: string, text: string): Promise<ChatPostMessageResponse> {
    return await this.client.chat.postMessage({
      channel,
      text,
    });
  }

  async listChannels(options: ListChannelsOptions): Promise<Channel[]> {
    const response = await this.client.conversations.list({
      types: options.types,
      exclude_archived: options.exclude_archived,
      limit: options.limit,
    });

    return response.channels as Channel[];
  }

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    const response = await this.client.conversations.history({
      channel,
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
    // Get all conversations the user is a member of
    const response = await this.client.conversations.list({
      types: 'public_channel,private_channel,im,mpim',
      exclude_archived: true,
      limit: 1000,
    });

    const channels = response.channels as Channel[];

    // Get unread count for each channel
    const channelsWithUnread = await Promise.all(
      channels.map(async (channel) => {
        try {
          const info = await this.client.conversations.info({
            channel: channel.id,
            include_num_members: false,
          });
          const channelInfo = info.channel as any;
          return {
            ...channel,
            unread_count: channelInfo.unread_count || 0,
            unread_count_display: channelInfo.unread_count_display || 0,
            last_read: channelInfo.last_read,
          };
        } catch {
          return channel;
        }
      })
    );

    // Filter to only channels with unread messages
    return channelsWithUnread.filter((channel) => (channel.unread_count_display || 0) > 0);
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    // First, find the channel
    let channelId = channelNameOrId;
    if (!channelNameOrId.startsWith('C') && !channelNameOrId.startsWith('D') && !channelNameOrId.startsWith('G')) {
      // It's a name, not an ID - need to find the ID
      const channels = await this.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 1000,
      });
      const channel = channels.find((c) => c.name === channelNameOrId || c.name === channelNameOrId.replace('#', ''));
      if (!channel) {
        throw new Error('channel_not_found');
      }
      channelId = channel.id;
    }

    // Get channel info with unread count
    const info = await this.client.conversations.info({
      channel: channelId,
    });
    const channel = info.channel as any;

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
