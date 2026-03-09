import type { SearchMatch, SearchMessagesOptions, SearchResult } from '../../types/slack';
import { BaseSlackClient, SlackClientDependency } from './base-client';

export class SearchOperations extends BaseSlackClient {
  constructor(dependency: SlackClientDependency) {
    super(dependency);
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
}
