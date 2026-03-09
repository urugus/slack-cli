import type {
  CanvasFile,
  CanvasSection,
  CanvasSectionElement,
} from '../utils/slack-operations/canvas-operations';
import type {
  ChannelMembersOptions,
  ChannelMembersResult,
} from '../utils/slack-operations/channel-operations';
import type { PinnedItem } from '../utils/slack-operations/pin-operations';
import type { Reminder } from '../utils/slack-operations/reminder-operations';
import type {
  SearchMatch,
  SearchMessagesOptions,
  SearchResult,
} from '../utils/slack-operations/search-operations';
import type { StarListResult, StarredItem } from '../utils/slack-operations/star-operations';
import type { SlackUser, UserPresence } from '../utils/slack-operations/user-operations';

export type {
  CanvasFile,
  CanvasSection,
  CanvasSectionElement,
  ChannelMembersOptions,
  ChannelMembersResult,
  PinnedItem,
  Reminder,
  SearchMatch,
  SearchMessagesOptions,
  SearchResult,
  SlackUser,
  StarListResult,
  StarredItem,
  UserPresence,
};

export interface Channel {
  id: string;
  name: string;
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
