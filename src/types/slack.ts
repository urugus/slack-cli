export interface CanvasSectionElement {
  type?: string;
  text?: string;
  elements?: CanvasSectionElement[];
}

export interface CanvasSection {
  id?: string;
  elements?: CanvasSectionElement[];
}

export interface CanvasFile {
  id?: string;
  name?: string;
  created?: number;
  filetype?: string;
}

export interface ChannelMembersOptions {
  limit?: number;
  cursor?: string;
}

export interface ChannelMembersResult {
  members: string[];
  nextCursor: string;
}

export interface PinnedItem {
  type?: string;
  created?: number;
  created_by?: string;
  message?: {
    text?: string;
    user?: string;
    ts?: string;
  };
}

export interface Reminder {
  id: string;
  text: string;
  time: number;
  complete_ts: number;
  recurring: boolean;
}

export interface SearchMatch {
  text?: string;
  user?: string;
  username?: string;
  ts?: string;
  channel: {
    id?: string;
    name?: string;
  };
  permalink?: string;
}

export interface SearchMessagesOptions {
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
  count?: number;
  page?: number;
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
  totalCount: number;
  page: number;
  pageCount: number;
}

export interface StarredItem {
  type: string;
  channel: string;
  message: {
    text: string;
    ts: string;
  };
  date_create: number;
}

export interface StarListResult {
  items: StarredItem[];
}

export interface UserPresence {
  presence: string;
}

export interface SlackUser {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    title?: string;
    status_text?: string;
    status_emoji?: string;
  };
  tz?: string;
  tz_label?: string;
  is_admin?: boolean;
  is_bot?: boolean;
  deleted?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  display_name?: string;
  user?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private: boolean;
  created: number;
  is_archived?: boolean;
  is_general?: boolean;
  unlinked?: number;
  name_normalized?: string;
  is_shared?: boolean;
  is_ext_shared?: boolean;
  is_org_shared?: boolean;
  is_member?: boolean;
  num_members?: number;
  unread_count?: number;
  unread_count_display?: number;
  last_read?: string;
  topic?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
  purpose?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
}

export interface ChannelDetail {
  id: string;
  name: string;
  is_private: boolean;
  is_archived?: boolean;
  created: number;
  num_members?: number;
  topic?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
  purpose?: {
    value: string;
    creator?: string;
    last_set?: number;
  };
}

export interface ListChannelsOptions {
  types: string;
  exclude_archived: boolean;
  limit: number;
}

export interface HistoryOptions {
  limit: number;
  oldest?: string;
}

export interface Message {
  type: string;
  text?: string;
  user?: string;
  bot_id?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  attachments?: unknown[];
  blocks?: unknown[];
}

export interface ScheduledMessage {
  id: string;
  channel_id: string;
  post_at: number;
  date_created: number;
  text?: string;
}

export interface HistoryResult {
  messages: Message[];
  users: Map<string, string>;
}

export interface ChannelUnreadResult {
  channel: Channel;
  messages: Message[];
  users: Map<string, string>;
  totalUnreadCount: number;
  displayedMessageCount: number;
}
