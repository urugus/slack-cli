import { createWriteStream } from 'fs';
import { access, mkdir, rm } from 'fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

/** A file object as returned inside a message's `files` array by conversations.replies. */
export interface ThreadFile {
  id: string;
  name?: string;
  title?: string;
  filetype?: string;
  size?: number;
  mode?: string;
  is_external?: boolean;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
}

export interface ListThreadFilesOptions {
  /** When set, only collect files attached to the message with this exact timestamp. */
  messageTs?: string;
}

export interface DownloadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  contentType: string;
}

export class FileOperations extends BaseSlackClient {
  private channelOps: ChannelOperations;
  private token?: string;

  constructor(dependency: SlackClientDependency, channelOps?: ChannelOperations, token?: string) {
    super(dependency);
    this.channelOps = channelOps ?? new ChannelOperations(dependency);
    // Capture the token explicitly rather than reaching into WebClient internals,
    // so downloads keep working regardless of the @slack/web-api version.
    this.token = token ?? (typeof dependency === 'string' ? dependency : undefined);
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

  /**
   * Collect the file objects attached to a thread (optionally narrowed to a
   * single message). Paginates conversations.replies so every reply is scanned.
   */
  async listThreadFiles(
    channel: string,
    threadTs: string,
    options: ListThreadFilesOptions = {}
  ): Promise<ThreadFile[]> {
    const channelId = await this.channelOps.resolveChannelId(channel);
    const files: ThreadFile[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        cursor,
        limit: 200,
      });

      for (const message of response.messages ?? []) {
        if (options.messageTs && message.ts !== options.messageTs) {
          continue;
        }
        for (const file of (message.files ?? []) as ThreadFile[]) {
          files.push(file);
        }
      }

      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return files;
  }

  /**
   * Download a single Slack file object to destDir, reusing the authenticated
   * token for the Authorization header that url_private(_download) requires.
   * The response body is streamed to disk so large files never sit fully in memory.
   */
  async downloadFile(file: ThreadFile, destDir: string): Promise<DownloadedFile> {
    const label = file.name || file.title || file.id;
    const url = file.url_private_download || file.url_private;
    if (!url) {
      throw new FileError(
        `File "${label}" has no downloadable URL (mode: ${file.mode ?? 'unknown'}). ` +
          'External or hosted files cannot be downloaded.'
      );
    }

    if (!this.token) {
      throw new FileError('No authentication token is available for downloading files.');
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new FileError(
        `Failed to download "${label}": HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Slack responds with a 200 HTML login page when the token lacks access.
    if (contentType.includes('text/html') && file.filetype !== 'html') {
      throw new FileError(
        `Received an HTML page instead of file data for "${label}" — ` +
          'the token may lack access to this file.'
      );
    }

    if (!response.body) {
      throw new FileError(`Empty response body while downloading "${label}".`);
    }

    const resolvedDir = resolve(destDir);
    await mkdir(resolvedDir, { recursive: true });
    const destPath = await this.resolveDestPath(resolvedDir, file);

    let size = 0;
    const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
    source.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });

    try {
      await pipeline(source, createWriteStream(destPath));
    } catch (error) {
      await rm(destPath, { force: true }).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      throw new FileError(`Failed while writing "${label}": ${message}`);
    }

    return {
      id: file.id,
      name: basename(destPath),
      path: destPath,
      size,
      contentType,
    };
  }

  /**
   * Build a safe, collision-free destination path inside resolvedDir.
   * Slack file names are user-controlled, so they are reduced to a basename and
   * checked to never escape the output directory (path traversal guard).
   */
  private async resolveDestPath(resolvedDir: string, file: ThreadFile): Promise<string> {
    const filename = sanitizeFilename(file.name, file.id);
    const candidate = resolve(resolvedDir, filename);
    const rel = relative(resolvedDir, candidate);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new FileError(
        `Refusing to write "${file.name ?? file.id}" outside the output directory.`
      );
    }

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    // Deconflict duplicate names by appending the unique Slack file id, then a
    // counter, looping until a free path is found so nothing is overwritten.
    const ext = extname(filename);
    const stem = filename.slice(0, filename.length - ext.length);
    for (let attempt = 1; ; attempt++) {
      const suffix = attempt === 1 ? `-${file.id}` : `-${file.id}-${attempt}`;
      const next = resolve(resolvedDir, `${stem}${suffix}${ext}`);
      if (!(await pathExists(next))) {
        return next;
      }
    }
  }
}

/**
 * Reduce a Slack-supplied file name to a single safe path segment via basename.
 * Falls back to the file id when the result is empty, is `.`/`..`, still contains
 * a path separator (e.g. a backslash on POSIX, which basename does not strip), or
 * contains any control character. Combined with the containment check in
 * resolveDestPath, this prevents path traversal from attacker-controlled names.
 */
function sanitizeFilename(rawName: string | undefined, fallbackId: string): string {
  const base = basename((rawName ?? '').trim());
  const hasSeparator = base.includes('/') || base.includes('\\');
  const hasControlChar = Array.from(base).some((char) => char.charCodeAt(0) < 0x20);
  if (!base || base === '.' || base === '..' || hasSeparator || hasControlChar) {
    return fallbackId;
  }
  return base;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
