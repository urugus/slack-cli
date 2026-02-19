import { BaseSlackClient } from './base-client';

export interface SearchMatch {
  text?: string;
  user?: string;
  username?: string;
  ts?: string;
  channel: {
    id?: string;
    name?: string;
  };
  permalink?: string;
}

export interface SearchMessagesOptions {
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
  count?: number;
  page?: number;
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
  totalCount: number;
  page: number;
  pageCount: number;
}

export class SearchOperations extends BaseSlackClient {
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
    }));

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
