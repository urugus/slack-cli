import type {
  ChatPostEphemeralResponse,
  ChatPostMessageResponse,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
} from '@slack/web-api';
import type {
  ChannelUnreadResult,
  HistoryOptions,
  HistoryResult,
  ScheduledMessage,
} from '../../types/slack';
import { BaseSlackClient, createSlackClientContext, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';
import { MessageHistoryOperations } from './message-history-operations';
import { MessagePermalinkOperations } from './message-permalink-operations';
import { MessageUserResolver } from './message-user-resolver';
import { MessageWriteOperations } from './message-write-operations';

export class MessageOperations extends BaseSlackClient {
  private writeOps: MessageWriteOperations;
  private historyOps: MessageHistoryOperations;
  private permalinkOps: MessagePermalinkOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    const sharedDependency =
      typeof dependency === 'string' ? createSlackClientContext(dependency) : dependency;

    super(sharedDependency);
    const resolvedChannelOps = channelOps ?? new ChannelOperations(sharedDependency);
    const userResolver = new MessageUserResolver(sharedDependency);

    this.writeOps = new MessageWriteOperations(sharedDependency, resolvedChannelOps);
    this.historyOps = new MessageHistoryOperations(
      sharedDependency,
      resolvedChannelOps,
      userResolver
    );
    this.permalinkOps = new MessagePermalinkOperations(sharedDependency, resolvedChannelOps);
  }

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostMessageResponse> {
    return await this.writeOps.sendMessage(channel, text, thread_ts);
  }

  async sendEphemeralMessage(
    channel: string,
    user: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostEphemeralResponse> {
    return await this.writeOps.sendEphemeralMessage(channel, user, text, thread_ts);
  }

  async scheduleMessage(
    channel: string,
    text: string,
    post_at: number,
    thread_ts?: string
  ): Promise<ChatScheduleMessageResponse> {
    return await this.writeOps.scheduleMessage(channel, text, post_at, thread_ts);
  }

  async listScheduledMessages(channel?: string, limit = 50): Promise<ScheduledMessage[]> {
    return await this.writeOps.listScheduledMessages(channel, limit);
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<ChatUpdateResponse> {
    return await this.writeOps.updateMessage(channel, ts, text);
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    await this.writeOps.deleteMessage(channel, ts);
  }

  async cancelScheduledMessage(channel: string, scheduledMessageId: string): Promise<void> {
    await this.writeOps.cancelScheduledMessage(channel, scheduledMessageId);
  }

  async getHistory(channel: string, options: HistoryOptions): Promise<HistoryResult> {
    return await this.historyOps.getHistory(channel, options);
  }

  async getThreadHistory(channel: string, threadTs: string): Promise<HistoryResult> {
    return await this.historyOps.getThreadHistory(channel, threadTs);
  }

  async getChannelUnread(channelNameOrId: string): Promise<ChannelUnreadResult> {
    return await this.historyOps.getChannelUnread(channelNameOrId);
  }

  async markAsRead(channelId: string): Promise<void> {
    await this.historyOps.markAsRead(channelId);
  }

  async getPermalink(channel: string, messageTs: string): Promise<string | null> {
    return await this.permalinkOps.getPermalink(channel, messageTs);
  }

  async getPermalinks(channel: string, messageTimestamps: string[]): Promise<Map<string, string>> {
    return await this.permalinkOps.getPermalinks(channel, messageTimestamps);
  }
}
