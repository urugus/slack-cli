import { BaseSlackClient, type SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export interface AssistantThreadStatusOptions {
  channel: string;
  threadTs: string;
  status: string;
  loadingMessages?: string[];
}

export interface AssistantThreadStatusResponse {
  ok: boolean;
  [key: string]: unknown;
}

interface AssistantThreadsSetStatusArguments {
  channel_id: string;
  thread_ts: string;
  status: string;
  loading_messages?: string[];
}

type AssistantCapableClient = {
  assistant?: {
    threads?: {
      setStatus?: (
        options: AssistantThreadsSetStatusArguments
      ) => Promise<AssistantThreadStatusResponse>;
    };
  };
  apiCall: (
    method: string,
    options?: Record<string, unknown>
  ) => Promise<AssistantThreadStatusResponse>;
};

export class AssistantOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async setThreadStatus(
    options: AssistantThreadStatusOptions
  ): Promise<AssistantThreadStatusResponse> {
    const channelId = await this.channelOps.resolveChannelId(options.channel);
    const params: AssistantThreadsSetStatusArguments = {
      channel_id: channelId,
      thread_ts: options.threadTs,
      status: options.status,
    };

    if (options.loadingMessages && options.loadingMessages.length > 0) {
      params.loading_messages = options.loadingMessages;
    }

    const client = this.client as unknown as AssistantCapableClient;
    const setStatus = client.assistant?.threads?.setStatus;
    if (setStatus) {
      return await setStatus(params);
    }

    return await client.apiCall('assistant.threads.setStatus', { ...params });
  }

  async clearThreadStatus(
    channel: string,
    threadTs: string
  ): Promise<AssistantThreadStatusResponse> {
    return await this.setThreadStatus({
      channel,
      threadTs,
      status: '',
    });
  }
}
