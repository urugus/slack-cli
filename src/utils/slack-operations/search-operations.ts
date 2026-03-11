import type { Channel, SearchMatch, SearchMessagesOptions, SearchResult } from '../../types/slack';
import { RATE_LIMIT } from '../constants';
import { BaseSlackClient, SlackClientDependency } from './base-client';

interface SearchMessageMatch {
  ts?: string;
  channel?: {
    id?: string;
    name?: string;
    is_channel?: boolean;
    is_group?: boolean;
    is_im?: boolean;
    is_mpim?: boolean;
    is_private?: boolean;
  };
}

const UNREAD_SEARCH_QUERY = 'is:unread';
const UNREAD_SEARCH_PAGE_SIZE = 100;

export class SearchOperations extends BaseSlackClient {
  constructor(dependency: SlackClientDependency) {
    super(dependency);
  }

  async listUnreadChannels(): Promise<Channel[]> {
    const firstPage = await this.fetchSearchPage(UNREAD_SEARCH_QUERY, 1, UNREAD_SEARCH_PAGE_SIZE);
    const matches = [...((firstPage.messages?.matches || []) as SearchMessageMatch[])];
    const pageCount = firstPage.messages?.pagination?.page_count || 1;

    if (pageCount > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) =>
          this.rateLimiter(() =>
            this.fetchSearchPage(UNREAD_SEARCH_QUERY, index + 2, UNREAD_SEARCH_PAGE_SIZE)
          )
        )
      );

      for (const page of remainingPages) {
        matches.push(...((page.messages?.matches || []) as SearchMessageMatch[]));
      }
    }

    return this.aggregateUnreadChannels(matches);
  }

  async searchMessages(query: string, options: SearchMessagesOptions = {}): Promise<SearchResult> {
    const { sort = 'score', sortDir = 'desc', count = 20, page = 1 } = options;

    const response = await this.client.search.messages({
      query,
      sort,
      sort_dir: sortDir,
      count,
      page,
    });

    const matches = (response.messages?.matches || []).map((match) => ({
      text: match.text,
      user: match.user,
      username: match.username,
      ts: match.ts,
      channel: {
        id: match.channel?.id,
        name: match.channel?.name,
      },
      permalink: match.permalink,
    })) as SearchMatch[];

    const pagination = response.messages?.pagination;

    return {
      query: response.query || query,
      matches,
      totalCount: pagination?.total_count || 0,
      page: pagination?.page || 1,
      pageCount: pagination?.page_count || 0,
    };
  }

  private async fetchSearchPage(query: string, page: number, count: number) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.client.search.messages({
          query,
          sort: 'timestamp',
          sort_dir: 'desc',
          count,
          page,
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

  private aggregateUnreadChannels(matches: SearchMessageMatch[]): Channel[] {
    const channels = new Map<string, Channel>();

    for (const match of matches) {
      const channelId = match.channel?.id;
      if (!channelId) {
        continue;
      }

      const existing = channels.get(channelId);
      const unreadCount = (existing?.unread_count ?? 0) + 1;
      const latestTs = this.maxSlackTimestamp(existing?.last_read, match.ts);

      if (existing) {
        existing.unread_count = unreadCount;
        existing.unread_count_display = unreadCount;
        existing.last_read = latestTs;
        continue;
      }

      channels.set(channelId, {
        id: channelId,
        name: match.channel?.name || channelId,
        is_channel: match.channel?.is_channel,
        is_group: match.channel?.is_group,
        is_im: match.channel?.is_im,
        is_mpim: match.channel?.is_mpim,
        is_private: match.channel?.is_private ?? false,
        created: 0,
        unread_count: unreadCount,
        unread_count_display: unreadCount,
        last_read: latestTs,
      });
    }

    return [...channels.values()].sort(
      (left, right) =>
        Number.parseFloat(right.last_read || '0') - Number.parseFloat(left.last_read || '0')
    );
  }

  private maxSlackTimestamp(current?: string, candidate?: string): string | undefined {
    if (!candidate) {
      return current;
    }

    if (!current) {
      return candidate;
    }

    return Number.parseFloat(candidate) > Number.parseFloat(current) ? candidate : current;
  }
}
