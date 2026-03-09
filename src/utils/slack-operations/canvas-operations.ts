import type { CanvasFile, CanvasSection } from '../../types/slack';
import { channelResolver } from '../channel-resolver';
import { DEFAULTS } from '../constants';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class CanvasOperations extends BaseSlackClient {
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

  async readCanvas(canvasId: string): Promise<CanvasSection[]> {
    const response = await this.client.canvases.sections.lookup({
      canvas_id: canvasId,
      criteria: { section_types: ['any_header'] },
    });
    return (response.sections || []) as CanvasSection[];
  }

  async listCanvases(channel: string): Promise<CanvasFile[]> {
    const channelId = await this.resolveChannel(channel);
    const response = await this.client.files.list({
      channel: channelId,
      types: 'spaces',
    });
    return (response.files || []) as CanvasFile[];
  }
}
