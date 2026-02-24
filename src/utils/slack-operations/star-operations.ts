import { BaseSlackClient } from './base-client';

export interface StarredItem {
  type: string;
  channel: string;
  message: {
    text: string;
    ts: string;
  };
  date_create: number;
}

export interface StarListResult {
  items: StarredItem[];
}

export class StarOperations extends BaseSlackClient {
  async addStar(channel: string, timestamp: string): Promise<void> {
    await this.client.stars.add({
      channel,
      timestamp,
    });
  }

  async listStars(count = 100, cursor?: string): Promise<StarListResult> {
    const response = await this.client.stars.list({
      count,
      cursor,
    });
    return {
      items: ((response as any).items || []) as StarredItem[],
    };
  }

  async removeStar(channel: string, timestamp: string): Promise<void> {
    await this.client.stars.remove({
      channel,
      timestamp,
    });
  }
}
