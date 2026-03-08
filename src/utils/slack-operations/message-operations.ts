import {
  ChatPostEphemeralArguments,
  ChatPostEphemeralResponse,
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  ChatScheduleMessageArguments,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
} from '@slack/web-api';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS, RATE_LIMIT } from '../constants';
import { extractAllUserIds } from '../mention-utils';
import {
  ChannelUnreadResult,
  HistoryOptions,
  HistoryResult,
  Message,
  ScheduledMessage,
} from '../slack-api-client';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class MessageOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostMessageResponse> {
    const params: ChatPostMessageArguments = {
      channel,
      text,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.postMessage(params);
  }

  async sendEphemeralMessage(
    channel: string,
    user: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostEphemeralResponse> {
    const params: ChatPostEphemeralArguments = {
      channel,
      user,
      text,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.postEphemeral(params);
  }

  async scheduleMessage(
    channel: string,
    text: string,
    post_at: number,
    thread_ts?: string
  ): Promise<ChatScheduleMessageResponse> {
    const params: ChatScheduleMessageArguments = {
      channel,
      text,
      post_at,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.scheduleMessage(params);
  }

  async listScheduledMessages(channel?: string, limit = 50): Promise<ScheduledMessage[]> {
    const channelId = channel
      ? await channelResolver.resolveChannelId(channel, () =>
          this.channelOps.listChannels({
            types: 'public_channel,private_channel,im,mpim',
            exclude_archived: true,
            limit: DEFAULTS.CHANNELS_LIMIT,
          })
        )
      : undefined;

    const response = await this.client.chat.scheduledMessages.list({
      limit,
      ...(channelId ? { channel: channelId } : {}),
    });
    return (response.scheduled_messages || []) as ScheduledMessage[];
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<ChatUpdateResponse> {
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    return await this.client.chat.update({
      channel: channelId,
      ts,
      text,
    });
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.chat.delete({
      channel: channelId,
      ts,
    });
  }

  async cancelScheduledMessage(channel: string, scheduledMessageId: string): Promise<void> {
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    await this.client.chat.deleteScheduledMessage({
      channel: channelId,
      scheduled_message_id: scheduledMessageId,
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

  async getThreadHistory(channel: string, threadTs: string): Promise<HistoryResult> {
    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    const messages: Message[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        cursor,
      });

      messages.push(...((response.messages || []) as Message[]));
      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    const userIds = extractAllUserIds(messages);
    const users = await this.fetchUserInfo(userIds);

    return { messages, users };
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    const channel = await this.channelOps.getChannelInfo(channelNameOrId);
    const summary = await this.getUnreadMessageSummary(
      channel.id,
      channel.last_read,
      DEFAULTS.UNREAD_MESSAGE_PREVIEW_LIMIT
    );
    const userIds = extractAllUserIds(summary.messages);
    const users = await this.fetchUserInfo(userIds);

    return {
      channel: {
        ...channel,
        unread_count: summary.totalCount,
        unread_count_display: summary.totalCount,
      },
      messages: summary.messages,
      users,
      totalUnreadCount: summary.totalCount,
      displayedMessageCount: summary.messages.length,
    };
  }

  private async getUnreadMessageSummary(
    channelId: string,
    lastRead: string | undefined,
    previewLimit: number
  ): Promise<{ totalCount: number; messages: Message[] }> {
    const messages: Message[] = [];
    let totalCount = 0;
    let cursor: string | undefined;

    do {
      const response = await this.fetchHistoryPage(channelId, lastRead, cursor);

      const pageMessages = (response.messages || []) as Message[];
      totalCount += pageMessages.length;

      if (messages.length < previewLimit) {
        messages.push(...pageMessages.slice(0, previewLimit - messages.length));
      }

      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return { totalCount, messages };
  }

  private async fetchHistoryPage(channelId: string, lastRead?: string, cursor?: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.client.conversations.history({
          channel: channelId,
          oldest: lastRead,
          limit: 200,
          cursor,
        });
      } catch (error) {
        const isRateLimitError = error instanceof Error && error.message?.includes('rate limit');
        if (!isRateLimitError || attempt >= RATE_LIMIT.RETRY_CONFIG.retries) {
          throw error;
        }

        await this.handleRateLimit(error);
      }
    }
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
        } catch (_error) {
          // If we can't get user info, we'll use the ID
          users.set(userId, userId);
        }
      }
    }

    return users;
  }

  async markAsRead(channelId: string): Promise<void> {
    await this.client.conversations.mark({
      channel: channelId,
      ts: Date.now() / 1000 + '',
    });
  }

  async getPermalink(channel: string, messageTs: string): Promise<string | null> {
    try {
      const channelId = await channelResolver.resolveChannelId(channel, () =>
        this.channelOps.listChannels({
          types: 'public_channel,private_channel,im,mpim',
          exclude_archived: true,
          limit: DEFAULTS.CHANNELS_LIMIT,
        })
      );

      const response = await this.client.chat.getPermalink({
        channel: channelId,
        message_ts: messageTs,
      });
      return response.permalink || null;
    } catch {
      return null;
    }
  }

  async getPermalinks(channel: string, messageTimestamps: string[]): Promise<Map<string, string>> {
    const permalinks = new Map<string, string>();

    if (messageTimestamps.length === 0) {
      return permalinks;
    }

    const channelId = await channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );

    for (const ts of messageTimestamps) {
      try {
        const response = await this.client.chat.getPermalink({
          channel: channelId,
          message_ts: ts,
        });
        if (response.permalink) {
          permalinks.set(ts, response.permalink);
        }
      } catch {
        // Skip failed permalink retrievals gracefully
      }
    }

    return permalinks;
  }
}
