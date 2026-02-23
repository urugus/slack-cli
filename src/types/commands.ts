export interface ConfigSetOptions {
  token: string;
  profile?: string;
}

export interface ConfigGetOptions {
  profile?: string;
}

export interface ConfigUseOptions {
  profile: string;
}

export interface ConfigClearOptions {
  profile?: string;
}

export interface SendOptions {
  channel: string;
  message?: string;
  file?: string;
  thread?: string;
  at?: string;
  after?: string;
  profile?: string;
}

export interface ScheduledListOptions {
  channel?: string;
  limit?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface ScheduledCancelOptions {
  channel: string;
  id: string;
  profile?: string;
}

export interface ChannelsOptions {
  type: 'public' | 'private' | 'im' | 'mpim' | 'all';
  includeArchived: boolean;
  format: 'table' | 'simple' | 'json';
  limit: string;
  profile?: string;
}

export interface HistoryOptions {
  channel: string;
  number?: string;
  since?: string;
  thread?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface UnreadOptions {
  channel?: string;
  format?: 'table' | 'simple' | 'json';
  countOnly?: boolean;
  limit?: string;
  markRead?: boolean;
  profile?: string;
}

export interface UploadOptions {
  channel: string;
  file?: string;
  content?: string;
  filename?: string;
  title?: string;
  message?: string;
  filetype?: string;
  thread?: string;
  profile?: string;
}

export interface EditOptions {
  channel: string;
  ts: string;
  message: string;
  profile?: string;
}

export interface DeleteOptions {
  channel: string;
  ts: string;
  profile?: string;
}

export interface ReactionOptions {
  channel: string;
  timestamp: string;
  emoji: string;
  profile?: string;
}

export interface PinOptions {
  channel: string;
  timestamp: string;
  profile?: string;
}

export interface PinListOptions {
  channel: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface SearchOptions {
  query: string;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
  number?: string;
  page?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}
