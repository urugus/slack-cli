import type { StarListResult, StarredItem } from '../../types/slack';
import { BaseSlackClient, SlackClientDependency } from './base-client';

export class StarOperations extends BaseSlackClient {
  constructor(dependency: SlackClientDependency) {
    super(dependency);
  }

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
      items: ((response as { items?: StarredItem[] }).items || []) as StarredItem[],
    };
  }

  async removeStar(channel: string, timestamp: string): Promise<void> {
    await this.client.stars.remove({
      channel,
      timestamp,
    });
  }
}
