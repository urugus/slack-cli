import type {
  ChannelUnreadResult,
  HistoryOptions,
  HistoryResult,
  Message,
} from '../../types/slack';
import { DEFAULTS, RATE_LIMIT } from '../constants';
import { extractAllUserIds } from '../mention-utils';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';
import { MessageUserResolver } from './message-user-resolver';

/** @internal Internal split of MessageOperations history responsibilities. */
export class MessageHistoryOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;
  private userResolver: MessageUserResolver;

  constructor(
    dependency: SlackClientDependency,
    channelOps?: ChannelOperations,
    userResolver?: MessageUserResolver
  ) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
    this.userResolver = userResolver ?? new MessageUserResolver(dependency);
  }

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    const response = await this.client.conversations.history({
      channel: channelId,
      limit: options.limit,
      oldest: options.oldest,
    });

    const messages = response.messages as Message[];
    const users = await this.userResolver.fetchUserInfo(extractAllUserIds(messages));

    return { messages, users };
  }

  async getThreadHistory(channel: string, threadTs: string): Promise<HistoryResult> {
    const channelId = await this.channelOps.resolveChannelId(channel);
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

    const users = await this.userResolver.fetchUserInfo(extractAllUserIds(messages));

    return { messages, users };
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    const channel = await this.channelOps.getChannelInfo(channelNameOrId);
    const summary = await this.getUnreadMessageSummary(
      channel.id,
      channel.last_read,
      DEFAULTS.UNREAD_MESSAGE_PREVIEW_LIMIT
    );
    const users = await this.userResolver.fetchUserInfo(extractAllUserIds(summary.messages));

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

  async markAsRead(channelId: string): Promise<void> {
    await this.client.conversations.mark({
      channel: channelId,
      ts: Date.now() / 1000 + '',
    });
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
}
