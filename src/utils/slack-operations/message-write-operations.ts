import {
  ChatPostEphemeralArguments,
  ChatPostEphemeralResponse,
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  ChatScheduleMessageArguments,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
} from '@slack/web-api';
import type { ScheduledMessage } from '../../types/slack';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export class MessageWriteOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostMessageResponse> {
    const params: ChatPostMessageArguments = {
      channel,
      text,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.postMessage(params);
  }

  async sendEphemeralMessage(
    channel: string,
    user: string,
    text: string,
    thread_ts?: string
  ): Promise<ChatPostEphemeralResponse> {
    const params: ChatPostEphemeralArguments = {
      channel,
      user,
      text,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.postEphemeral(params);
  }

  async scheduleMessage(
    channel: string,
    text: string,
    post_at: number,
    thread_ts?: string
  ): Promise<ChatScheduleMessageResponse> {
    const params: ChatScheduleMessageArguments = {
      channel,
      text,
      post_at,
    };

    if (thread_ts) {
      params.thread_ts = thread_ts;
    }

    return await this.client.chat.scheduleMessage(params);
  }

  async listScheduledMessages(channel?: string, limit = 50): Promise<ScheduledMessage[]> {
    const channelId = channel ? await this.channelOps.resolveChannelId(channel) : undefined;
    const response = await this.client.chat.scheduledMessages.list({
      limit,
      ...(channelId ? { channel: channelId } : {}),
    });

    return (response.scheduled_messages || []) as ScheduledMessage[];
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<ChatUpdateResponse> {
    const channelId = await this.channelOps.resolveChannelId(channel);

    return await this.client.chat.update({
      channel: channelId,
      ts,
      text,
    });
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);

    await this.client.chat.delete({
      channel: channelId,
      ts,
    });
  }

  async cancelScheduledMessage(channel: string, scheduledMessageId: string): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(channel);

    await this.client.chat.deleteScheduledMessage({
      channel: channelId,
      scheduled_message_id: scheduledMessageId,
    });
  }
}
