import type { PinnedItem } from '../../types/slack';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class PinOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
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

  async addPin(channel: string, timestamp: string): Promise<void> {
    const channelId = await this.resolveChannel(channel);
    await this.client.pins.add({
      channel: channelId,
      timestamp,
    });
  }

  async removePin(channel: string, timestamp: string): Promise<void> {
    const channelId = await this.resolveChannel(channel);
    await this.client.pins.remove({
      channel: channelId,
      timestamp,
    });
  }

  async listPins(channel: string): Promise<PinnedItem[]> {
    const channelId = await this.resolveChannel(channel);
    const response = await this.client.pins.list({
      channel: channelId,
    });
    return (response.items || []) as PinnedItem[];
  }
}
