import { ValidationError } from './errors';

export interface ParsedSlackMessageUrl {
  channel: string;
  messageTs: string;
  threadTs?: string;
}

export function parseSlackMessageUrl(value: string): ParsedSlackMessageUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`Invalid Slack message URL: ${value}`);
  }

  const match = url.pathname.match(/\/archives\/([^/]+)\/p(\d+)/);
  if (!match) {
    throw new ValidationError(`Invalid Slack message URL: ${value}`);
  }

  const threadTs = url.searchParams.get('thread_ts') || undefined;
  if (threadTs && !isSlackTimestamp(threadTs)) {
    throw new ValidationError('Invalid thread timestamp format');
  }

  return {
    channel: match[1],
    messageTs: permalinkTimestampToSlackTs(match[2]),
    threadTs,
  };
}

export function permalinkTimestampToSlackTs(value: string): string {
  if (!/^\d{16}$/.test(value)) {
    throw new ValidationError(`Invalid Slack permalink timestamp: ${value}`);
  }

  return `${value.slice(0, 10)}.${value.slice(10)}`;
}

function isSlackTimestamp(value: string): boolean {
  return /^\d{10}\.\d{6}$/.test(value);
}
