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
  channel?: string;
  user?: string;
  email?: string;
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
  withLink?: boolean;
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

export interface UsersListOptions {
  limit?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface UsersInfoOptions {
  id: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface UsersLookupOptions {
  email: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface UsersPresenceOptions {
  id?: string;
  name?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface ChannelInfoOptions {
  channel: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface ChannelSetTopicOptions {
  channel: string;
  topic: string;
  profile?: string;
}

export interface ChannelSetPurposeOptions {
  channel: string;
  purpose: string;
  profile?: string;
}

export interface MembersOptions {
  channel: string;
  limit?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface SendEphemeralOptions {
  channel: string;
  user: string;
  message: string;
  thread?: string;
  profile?: string;
}

export interface JoinOptions {
  channel: string;
  profile?: string;
}

export interface LeaveOptions {
  channel: string;
  profile?: string;
}

export interface InviteOptions {
  channel: string;
  users: string;
  force?: boolean;
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

export interface ReminderAddOptions {
  text: string;
  at?: string;
  after?: string;
  profile?: string;
}

export interface ReminderListOptions {
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface ReminderDeleteOptions {
  id: string;
  profile?: string;
}

export interface ReminderCompleteOptions {
  id: string;
  profile?: string;
}

export interface BookmarkAddOptions {
  channel: string;
  ts: string;
  profile?: string;
}

export interface BookmarkListOptions {
  limit?: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface BookmarkRemoveOptions {
  channel: string;
  ts: string;
  profile?: string;
}

export interface CanvasReadOptions {
  id: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}

export interface CanvasListOptions {
  channel: string;
  format?: 'table' | 'simple' | 'json';
  profile?: string;
}
