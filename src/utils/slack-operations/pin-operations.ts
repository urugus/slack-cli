import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

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

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async addPin(channel: string, timestamp: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    await this.client.pins.add({
      channel: channelId,
      timestamp,
    });
  }

  async removePin(channel: string, timestamp: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    await this.client.pins.remove({
      channel: channelId,
      timestamp,
    });
  }

  async listPins(channel: string): Promise<PinnedItem[]> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    const response = await this.client.pins.list({
      channel: channelId,
    });
    return (response.items || []) as PinnedItem[];
  }
}
