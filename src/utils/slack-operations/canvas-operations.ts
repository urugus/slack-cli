import type { CanvasesEditArguments } from '@slack/web-api';
import type { CanvasPosition } from '../../types/commands';
import type { CanvasFile, CanvasSection } from '../../types/slack';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

const CANVAS_POSITION_OPERATIONS: Record<
  CanvasPosition,
  'insert_at_end' | 'insert_at_start' | 'replace'
> = {
  end: 'insert_at_end',
  start: 'insert_at_start',
  replace: 'replace',
};

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

  async writeCanvas(canvasId: string, markdown: string, position: CanvasPosition): Promise<void> {
    const operation = CANVAS_POSITION_OPERATIONS[position];
    const args: CanvasesEditArguments = {
      canvas_id: canvasId,
      changes: [
        {
          operation,
          document_content: {
            type: 'markdown',
            markdown,
          },
        },
      ],
    };

    await this.client.canvases.edit(args);
  }
}
