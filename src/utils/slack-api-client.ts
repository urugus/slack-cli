import { WebClient, ChatPostMessageResponse } from '@slack/web-api';

interface Channel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private: boolean;
  created: number;
  is_archived?: boolean;
  is_general?: boolean;
  unlinked?: number;
  name_normalized?: string;
  is_shared?: boolean;
  is_ext_shared?: boolean;
  is_org_shared?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
  purpose?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
}

interface ListChannelsOptions {
  types: string;
  exclude_archived: boolean;
  limit: number;
}

export class SlackApiClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendMessage(channel: string, text: string): Promise<ChatPostMessageResponse> {
    return await this.client.chat.postMessage({
      channel,
      text,
    });
  }

  async listChannels(options: ListChannelsOptions): Promise<Channel[]> {
    const response = await this.client.conversations.list({
      types: options.types,
      exclude_archived: options.exclude_archived,
      limit: options.limit,
    });

    return response.channels as Channel[];
  }
}

export const slackApiClient = {
  listChannels: async (token: string, options: ListChannelsOptions): Promise<Channel[]> => {
    const client = new SlackApiClient(token);
    return client.listChannels(options);
  },
};
