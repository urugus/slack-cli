import { WebClient } from '@slack/web-api';

export class SlackApiClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendMessage(
    channel: string,
    text: string
  ): Promise<{
    ok: boolean;
    ts?: string;
    error?: string;
  }> {
    return await this.client.chat.postMessage({
      channel,
      text,
    });
  }
}
