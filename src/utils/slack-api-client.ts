import {
  ChatPostMessageResponse,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
} from '@slack/web-api';
import { ChannelOperations } from './slack-operations/channel-operations';
import { MessageOperations } from './slack-operations/message-operations';
import { FileOperations, UploadFileOptions } from './slack-operations/file-operations';
import { ReactionOperations } from './slack-operations/reaction-operations';
import { PinOperations, PinnedItem } from './slack-operations/pin-operations';
import {
  SearchOperations,
  SearchResult,
  SearchMessagesOptions,
  SearchMatch,
} from './slack-operations/search-operations';

export type { SearchResult, SearchMessagesOptions, SearchMatch, PinnedItem };

export interface Channel {
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
  unread_count?: number;
  unread_count_display?: number;
  last_read?: string;
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

export interface ListChannelsOptions {
  types: string;
  exclude_archived: boolean;
  limit: number;
}

export interface HistoryOptions {
  limit: number;
  oldest?: string;
}

export interface Message {
  type: string;
  text?: string;
  user?: string;
  bot_id?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  attachments?: unknown[];
  blocks?: unknown[];
}

export interface ScheduledMessage {
  id: string;
  channel_id: string;
  post_at: number;
  date_created: number;
  text?: string;
}

export interface HistoryResult {
  messages: Message[];
  users: Map<string, string>;
}

export interface ChannelUnreadResult {
  channel: Channel;
  messages: Message[];
  users: Map<string, string>;
}

export class SlackApiClient {
  private channelOps: ChannelOperations;
  private messageOps: MessageOperations;
  private fileOps: FileOperations;
  private reactionOps: ReactionOperations;
  private pinOps: PinOperations;
  private searchOps: SearchOperations;

  constructor(token: string) {
    this.channelOps = new ChannelOperations(token);
    this.messageOps = new MessageOperations(token);
    this.fileOps = new FileOperations(token);
    this.reactionOps = new ReactionOperations(token);
    this.pinOps = new PinOperations(token);
    this.searchOps = new SearchOperations(token);
  }

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostMessageResponse> {
    return this.messageOps.sendMessage(channel, text, thread_ts);
  }

  async scheduleMessage(
    channel: string,
    text: string,
    post_at: number,
    thread_ts?: string
  ): Promise<ChatScheduleMessageResponse> {
    return this.messageOps.scheduleMessage(channel, text, post_at, thread_ts);
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<ChatUpdateResponse> {
    return this.messageOps.updateMessage(channel, ts, text);
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    return this.messageOps.deleteMessage(channel, ts);
  }

  async listScheduledMessages(channel?: string, limit = 50): Promise<ScheduledMessage[]> {
    return this.messageOps.listScheduledMessages(channel, limit);
  }

  async cancelScheduledMessage(channel: string, scheduledMessageId: string): Promise<void> {
    return this.messageOps.cancelScheduledMessage(channel, scheduledMessageId);
  }

  async listChannels(options: ListChannelsOptions): Promise<Channel[]> {
    return this.channelOps.listChannels(options);
  }

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    return this.messageOps.getHistory(channel, options);
  }

  async getThreadHistory(channel: string, threadTs: string): Promise<HistoryResult> {
    return this.messageOps.getThreadHistory(channel, threadTs);
  }

  async listUnreadChannels(): Promise<Channel[]> {
    return this.channelOps.listUnreadChannels();
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    return this.messageOps.getChannelUnread(channelNameOrId);
  }

  async markAsRead(channelId: string): Promise<void> {
    return this.messageOps.markAsRead(channelId);
  }

  async uploadFile(options: UploadFileOptions): Promise<void> {
    return this.fileOps.uploadFile(options);
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    return this.reactionOps.addReaction(channel, timestamp, emoji);
  }

  async removeReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    return this.reactionOps.removeReaction(channel, timestamp, emoji);
  }

  async addPin(channel: string, timestamp: string): Promise<void> {
    return this.pinOps.addPin(channel, timestamp);
  }

  async removePin(channel: string, timestamp: string): Promise<void> {
    return this.pinOps.removePin(channel, timestamp);
  }

  async listPins(channel: string): Promise<PinnedItem[]> {
    return this.pinOps.listPins(channel);
  }

  async searchMessages(query: string, options?: SearchMessagesOptions): Promise<SearchResult> {
    return this.searchOps.searchMessages(query, options);
  }
}

export const slackApiClient = {
  listChannels: async (token: string, options: ListChannelsOptions): Promise<Channel[]> => {
    const client = new SlackApiClient(token);
    return client.listChannels(options);
  },
};
