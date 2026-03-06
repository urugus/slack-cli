import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { BaseSlackClient } from './base-client';
import { ChannelOperations } from './channel-operations';

export class ReactionOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(token: string) {
    super(token);
    this.channelOps = new ChannelOperations(token);
  }

  private stripColons(emoji: string): string {
    return emoji.replace(/^:/, '').replace(/:$/, '');
  }

  private async resolveChannel(channel: string): Promise<string> {
    return channelResolver.resolveChannelId(channel, () =>
      this.channelOps.listChannels({
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: DEFAULTS.CHANNELS_LIMIT,
      })
    );
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    const channelId = await this.resolveChannel(channel);
    await this.client.reactions.add({
      channel: channelId,
      timestamp,
      name: this.stripColons(emoji),
    });
  }

  async removeReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    const channelId = await this.resolveChannel(channel);
    await this.client.reactions.remove({
      channel: channelId,
      timestamp,
      name: this.stripColons(emoji),
    });
  }
}
