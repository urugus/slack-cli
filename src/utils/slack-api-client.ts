import {
  ChatPostEphemeralResponse,
  ChatPostMessageResponse,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
} from '@slack/web-api';
import { createSlackClientContext } from './slack-operations/base-client';
import {
  CanvasFile,
  CanvasOperations,
  CanvasSection,
  CanvasSectionElement,
} from './slack-operations/canvas-operations';
import {
  ChannelMembersOptions,
  ChannelMembersResult,
  ChannelOperations,
} from './slack-operations/channel-operations';
import { FileOperations, UploadFileOptions } from './slack-operations/file-operations';
import { MessageOperations } from './slack-operations/message-operations';
import { PinnedItem, PinOperations } from './slack-operations/pin-operations';
import { ReactionOperations } from './slack-operations/reaction-operations';
import { Reminder, ReminderOperations } from './slack-operations/reminder-operations';
import {
  SearchMatch,
  SearchMessagesOptions,
  SearchOperations,
  SearchResult,
} from './slack-operations/search-operations';
import { StarListResult, StarOperations, StarredItem } from './slack-operations/star-operations';
import { SlackUser, UserOperations, UserPresence } from './slack-operations/user-operations';

export type {
  SearchResult,
  SearchMessagesOptions,
  SearchMatch,
  PinnedItem,
  SlackUser,
  UserPresence,
  ChannelMembersOptions,
  ChannelMembersResult,
  Reminder,
  StarredItem,
  StarListResult,
  CanvasSection,
  CanvasSectionElement,
  CanvasFile,
};

export interface Channel {
  id: string;
  name: string;
  display_name?: string;
  user?: string;
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

export interface ChannelDetail {
  id: string;
  name: string;
  is_private: boolean;
  is_archived?: boolean;
  created: number;
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
  totalUnreadCount: number;
  displayedMessageCount: number;
}

export class SlackApiClient {
  private channelOps: ChannelOperations;
  private messageOps: MessageOperations;
  private fileOps: FileOperations;
  private reactionOps: ReactionOperations;
  private pinOps: PinOperations;
  private userOps: UserOperations;
  private searchOps: SearchOperations;
  private reminderOps: ReminderOperations;
  private starOps: StarOperations;
  private canvasOps: CanvasOperations;

  constructor(token: string) {
    const sharedContext = createSlackClientContext(token);
    this.channelOps = new ChannelOperations(sharedContext);
    this.messageOps = new MessageOperations(sharedContext, this.channelOps);
    this.fileOps = new FileOperations(sharedContext, this.channelOps);
    this.reactionOps = new ReactionOperations(sharedContext, this.channelOps);
    this.pinOps = new PinOperations(sharedContext, this.channelOps);
    this.userOps = new UserOperations(sharedContext);
    this.searchOps = new SearchOperations(sharedContext);
    this.reminderOps = new ReminderOperations(sharedContext);
    this.starOps = new StarOperations(sharedContext);
    this.canvasOps = new CanvasOperations(sharedContext, this.channelOps);
  }

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostMessageResponse> {
    return this.messageOps.sendMessage(channel, text, thread_ts);
  }

  async sendEphemeralMessage(
    channel: string,
    user: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostEphemeralResponse> {
    return this.messageOps.sendEphemeralMessage(channel, user, text, thread_ts);
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

  async getChannelDetail(channelNameOrId: string): Promise<ChannelDetail> {
    return this.channelOps.getChannelDetail(channelNameOrId);
  }

  async setTopic(channelNameOrId: string, topic: string): Promise<void> {
    return this.channelOps.setTopic(channelNameOrId, topic);
  }

  async setPurpose(channelNameOrId: string, purpose: string): Promise<void> {
    return this.channelOps.setPurpose(channelNameOrId, purpose);
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

  async getPermalink(channel: string, messageTs: string): Promise<string | null> {
    return this.messageOps.getPermalink(channel, messageTs);
  }

  async getPermalinks(channel: string, messageTimestamps: string[]): Promise<Map<string, string>> {
    return this.messageOps.getPermalinks(channel, messageTimestamps);
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

  async listUsers(limit?: number): Promise<SlackUser[]> {
    return this.userOps.listUsers(limit);
  }

  async getUserInfo(userId: string): Promise<SlackUser> {
    return this.userOps.getUserInfo(userId);
  }

  async lookupUserByEmail(email: string): Promise<SlackUser> {
    return this.userOps.lookupByEmail(email);
  }

  async openDmChannel(userId: string): Promise<string> {
    return this.userOps.openDmChannel(userId);
  }

  async getUserPresence(userId: string): Promise<UserPresence> {
    return this.userOps.getPresence(userId);
  }

  async resolveUserIdByName(username: string): Promise<string> {
    return this.userOps.resolveUserIdByName(username);
  }

  async searchMessages(query: string, options?: SearchMessagesOptions): Promise<SearchResult> {
    return this.searchOps.searchMessages(query, options);
  }

  async joinChannel(channelNameOrId: string): Promise<void> {
    return this.channelOps.joinChannel(channelNameOrId);
  }

  async leaveChannel(channelNameOrId: string): Promise<void> {
    return this.channelOps.leaveChannel(channelNameOrId);
  }

  async inviteToChannel(
    channelNameOrId: string,
    userIds: string[],
    force?: boolean
  ): Promise<void> {
    return this.channelOps.inviteToChannel(channelNameOrId, userIds, force);
  }

  async getChannelMembers(
    channelNameOrId: string,
    options?: ChannelMembersOptions
  ): Promise<ChannelMembersResult> {
    return this.channelOps.getChannelMembers(channelNameOrId, options);
  }

  async addReminder(text: string, time: number): Promise<Reminder> {
    return this.reminderOps.addReminder(text, time);
  }

  async listReminders(): Promise<Reminder[]> {
    return this.reminderOps.listReminders();
  }

  async deleteReminder(reminderId: string): Promise<void> {
    return this.reminderOps.deleteReminder(reminderId);
  }

  async completeReminder(reminderId: string): Promise<void> {
    return this.reminderOps.completeReminder(reminderId);
  }

  async addStar(channel: string, timestamp: string): Promise<void> {
    return this.starOps.addStar(channel, timestamp);
  }

  async listStars(count?: number): Promise<StarListResult> {
    return this.starOps.listStars(count);
  }

  async removeStar(channel: string, timestamp: string): Promise<void> {
    return this.starOps.removeStar(channel, timestamp);
  }

  async readCanvas(canvasId: string): Promise<CanvasSection[]> {
    return this.canvasOps.readCanvas(canvasId);
  }

  async listCanvases(channel: string): Promise<CanvasFile[]> {
    return this.canvasOps.listCanvases(channel);
  }
}

export const slackApiClient = {
  listChannels: async (token: string, options: ListChannelsOptions): Promise<Channel[]> => {
    const client = new SlackApiClient(token);
    return client.listChannels(options);
  },
};
