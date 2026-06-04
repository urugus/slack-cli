import * as fs from 'fs/promises';
import { basename, dirname, join } from 'path';
import { Message, SlackFile } from '../../types/slack';
import { FileError } from '../errors';
import { BaseSlackClient, SlackClientDependency } from './base-client';
import { ChannelOperations } from './channel-operations';

export interface UploadFileOptions {
  channel: string;
  filePath?: string;
  content?: string;
  filename?: string;
  title?: string;
  initialComment?: string;
  snippetType?: string;
  threadTs?: string;
}

export interface DownloadFileOptions {
  fileId?: string;
  channel?: string;
  messageTs?: string;
  threadTs?: string;
  fileIndex?: number;
  outputPath?: string;
  outputDir?: string;
}

export interface DownloadFileResult {
  file: SlackFile;
  path: string;
  bytes: number;
}

export class FileOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
  }

  async uploadFile(options: UploadFileOptions): Promise<void> {
    const channelId = await this.channelOps.resolveChannelId(options.channel);

    const params: Record<string, unknown> = {
      channel_id: channelId,
    };

    if (options.filePath) {
      params.file = options.filePath;
      params.filename = options.filename || basename(options.filePath);
    } else if (options.content) {
      params.content = options.content;
      params.filename = options.filename;
    }

    if (options.title) params.title = options.title;
    if (options.initialComment) params.initial_comment = options.initialComment;
    if (options.snippetType) params.snippet_type = options.snippetType;
    if (options.threadTs) params.thread_ts = options.threadTs;

    await this.client.files.uploadV2(
      params as unknown as Parameters<typeof this.client.files.uploadV2>[0]
    );
  }

  async downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
    const file = options.fileId
      ? await this.getFileInfo(options.fileId)
      : await this.getMessageFile(options);
    const outputPath = await this.resolveOutputPath(file, options);
    const url = file.url_private_download || file.url_private;

    if (!url) {
      throw new FileError('Selected Slack file does not include a private download URL');
    }

    const response = await this.fetchSlackFile(url);
    if (!response.ok) {
      throw new FileError(
        `Failed to download Slack file: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new FileError(
        'Slack returned HTML instead of the file. Verify the token has files:read and access to the file.'
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes);

    return { file, path: outputPath, bytes: bytes.length };
  }

  private async getFileInfo(fileId: string): Promise<SlackFile> {
    const response = await this.client.files.info({ file: fileId });
    const file = response.file as SlackFile | undefined;

    if (!file) {
      throw new FileError(`Slack file not found: ${fileId}`);
    }

    return file;
  }

  private async getMessageFile(options: DownloadFileOptions): Promise<SlackFile> {
    if (!options.channel || !options.messageTs) {
      throw new FileError(
        'Channel and message timestamp are required when file id is not specified'
      );
    }

    const message = await this.getMessage(options.channel, options.messageTs, options.threadTs);
    const files = message.files || [];

    if (files.length === 0) {
      throw new FileError(`No files found on message ${options.messageTs}`);
    }

    const fileIndex = options.fileIndex ?? 1;
    const file = files[fileIndex - 1];

    if (!file) {
      throw new FileError(
        `File index ${fileIndex} is out of range. Message has ${files.length} file(s).`
      );
    }

    return file;
  }

  private async getMessage(
    channel: string,
    messageTs: string,
    threadTs?: string
  ): Promise<Message> {
    const channelId = await this.channelOps.resolveChannelId(channel);

    if (threadTs) {
      let cursor: string | undefined;
      do {
        const response = await this.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
          cursor,
        });
        const messages = (response.messages || []) as Message[];
        const message = messages.find((item) => item.ts === messageTs);
        if (message) return message;
        cursor = response.response_metadata?.next_cursor || undefined;
      } while (cursor);

      throw new FileError(`Message ${messageTs} was not found in thread ${threadTs}`);
    }

    const response = await this.client.conversations.history({
      channel: channelId,
      latest: messageTs,
      inclusive: true,
      limit: 1,
    });
    const messages = (response.messages || []) as Message[];
    const message = messages.find((item) => item.ts === messageTs);

    if (!message) {
      throw new FileError(`Message ${messageTs} was not found in channel ${channel}`);
    }

    return message;
  }

  private async resolveOutputPath(file: SlackFile, options: DownloadFileOptions): Promise<string> {
    if (options.outputPath) {
      return options.outputPath;
    }

    const outputDir = options.outputDir || '.';
    const filename = basename(file.name || file.title || file.id || 'slack-file');
    await fs.mkdir(outputDir, { recursive: true });

    return join(outputDir, filename);
  }

  private async fetchSlackFile(url: string, redirectCount = 0): Promise<Response> {
    if (!this.token) {
      throw new FileError('Slack token is required to download private files');
    }

    const headers = this.shouldSendAuth(url)
      ? { Authorization: `Bearer ${this.token}` }
      : undefined;
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
    });

    if (!this.isRedirect(response.status)) {
      return response;
    }

    if (redirectCount >= 5) {
      throw new FileError('Too many redirects while downloading Slack file');
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new FileError('Slack file download redirected without a Location header');
    }

    return this.fetchSlackFile(new URL(location, url).toString(), redirectCount + 1);
  }

  private shouldSendAuth(url: string): boolean {
    const hostname = new URL(url).hostname;
    return hostname === 'slack.com' || hostname.endsWith('.slack.com');
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }
}
