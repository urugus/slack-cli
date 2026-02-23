import { BaseSlackClient } from './base-client';
import { channelResolver } from '../channel-resolver';
import { ChannelOperations } from './channel-operations';
import { DEFAULTS } from '../constants';

export interface PinnedItem {
  type?: string;
  created?: number;
  created_by?: string;
  message?: {
    text?: string;
    user?: string;
    ts?: string;
  };
}

export class PinOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(token: string) {
    super(token);
    this.channelOps = new ChannelOperations(token);
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
