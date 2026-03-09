import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class ReactionOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  private stripColons(emoji: string): string {
    return emoji.replace(/^:/, '').replace(/:$/, '');
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    await this.client.reactions.add({
      channel: channelId,
      timestamp,
      name: this.stripColons(emoji),
    });
  }

  async removeReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    await this.client.reactions.remove({
      channel: channelId,
      timestamp,
      name: this.stripColons(emoji),
    });
  }
}
