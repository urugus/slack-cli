import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export interface CanvasSectionElement {
  type?: string;
  text?: string;
  elements?: CanvasSectionElement[];
}

export interface CanvasSection {
  id?: string;
  elements?: CanvasSectionElement[];
}

export interface CanvasFile {
  id?: string;
  name?: string;
  created?: number;
  filetype?: string;
}

export class CanvasOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async readCanvas(canvasId: string): Promise<CanvasSection[]> {
    const response = await this.client.canvases.sections.lookup({
      canvas_id: canvasId,
      criteria: { section_types: ['any_header'] },
    });
    return (response.sections || []) as CanvasSection[];
  }

  async listCanvases(channel: string): Promise<CanvasFile[]> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    const response = await this.client.files.list({
      channel: channelId,
      types: 'spaces',
    });
    return (response.files || []) as CanvasFile[];
  }
}
