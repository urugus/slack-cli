import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class MessagePermalinkOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async getPermalink(channel: string, messageTs: string): Promise<string | null> {
    try {
      const channelId = await this.channelOps.resolveChannelId(channel);
      const response = await this.client.chat.getPermalink({
        channel: channelId,
        message_ts: messageTs,
      });

      return response.permalink || null;
    } catch {
      return null;
    }
  }

  async getPermalinks(channel: string, messageTimestamps: string[]): Promise<Map<string, string>> {
    const permalinks = new Map<string, string>();

    if (messageTimestamps.length === 0) {
      return permalinks;
    }

    const channelId = await this.channelOps.resolveChannelId(channel);

    for (const ts of messageTimestamps) {
      try {
        const response = await this.client.chat.getPermalink({
          channel: channelId,
          message_ts: ts,
        });
        if (response.permalink) {
          permalinks.set(ts, response.permalink);
        }
      } catch {
        // Skip failed permalink retrievals gracefully
      }
    }

    return permalinks;
  }
}
