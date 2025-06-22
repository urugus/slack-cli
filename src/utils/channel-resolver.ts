import { Channel } from './slack-api-client';

export type GetChannelsFunction = () => Promise<Channel[]>;

export class ChannelResolver {
  /**
   * Check if the given string is a channel ID
   */
  isChannelId(channelNameOrId: string): boolean {
    return (
      channelNameOrId.startsWith('C') ||
      channelNameOrId.startsWith('D') ||
      channelNameOrId.startsWith('G')
    );
  }

  /**
   * Find a channel by name from the given list
   */
  findChannel(channelName: string, channels: Channel[]): Channel | undefined {
    return channels.find((c) => {
      // Direct name match
      if (c.name === channelName) return true;
      // Match without # prefix
      if (c.name === channelName.replace('#', '')) return true;
      // Case-insensitive match
      if (c.name?.toLowerCase() === channelName.toLowerCase()) return true;
      // Match with normalized name
      if (c.name_normalized === channelName) return true;
      return false;
    });
  }

  /**
   * Get similar channel names for suggestions
   */
  getSimilarChannels(channelName: string, channels: Channel[], limit = 5): string[] {
    return channels
      .filter((c) => c.name?.toLowerCase().includes(channelName.toLowerCase()))
      .slice(0, limit)
      .map((c) => c.name as string);
  }

  /**
   * Create an error with channel suggestions
   */
  resolveChannelError(channelName: string, channels: Channel[]): Error {
    const similarChannels = this.getSimilarChannels(channelName, channels);

    if (similarChannels.length > 0) {
      return new Error(
        `Channel '${channelName}' not found. Did you mean one of these? ${similarChannels.join(', ')}`
      );
    } else {
      return new Error(
        `Channel '${channelName}' not found. Make sure you are a member of this channel.`
      );
    }
  }

  /**
   * Resolve a channel name or ID to a channel ID
   */
  async resolveChannelId(
    channelNameOrId: string,
    getChannels: GetChannelsFunction
  ): Promise<string> {
    // If it's already an ID, return it
    if (this.isChannelId(channelNameOrId)) {
      return channelNameOrId;
    }

    // Otherwise, fetch channels and resolve the name
    const channels = await getChannels();
    const channel = this.findChannel(channelNameOrId, channels);

    if (!channel) {
      throw this.resolveChannelError(channelNameOrId, channels);
    }

    return channel.id;
  }
}

// Export a singleton instance
export const channelResolver = new ChannelResolver();