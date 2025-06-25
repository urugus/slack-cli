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
