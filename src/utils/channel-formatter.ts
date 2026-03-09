import { formatUnixTimestamp } from './date-utils';
import { Channel } from '../types/slack';
import { sanitizeTerminalText } from './terminal-sanitizer';

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  members: number;
  created: string;
  purpose: string;
}

export function mapChannelToInfo(channel: Channel): ChannelInfo {
  let type = 'unknown';
  if (channel.is_channel && !channel.is_private) type = 'public';
  else if (channel.is_group || (channel.is_channel && channel.is_private)) type = 'private';
  else if (channel.is_im) type = 'im';
  else if (channel.is_mpim) type = 'mpim';

  return {
    id: channel.id,
    name: sanitizeTerminalText(channel.name || 'unnamed'),
    type,
    members: channel.num_members || 0,
    created: formatUnixTimestamp(channel.created),
    purpose: sanitizeTerminalText(channel.purpose?.value || ''),
  };
}

export function formatChannelName(channelName?: string): string {
  if (!channelName) return '#unknown';
  const sanitizedChannelName = sanitizeTerminalText(channelName);
  return sanitizedChannelName.startsWith('#') ? sanitizedChannelName : `#${sanitizedChannelName}`;
}

export function getChannelTypes(type: string): string {
  const channelTypeMap: Record<string, string> = {
    public: 'public_channel',
    private: 'private_channel',
    im: 'im',
    mpim: 'mpim',
    all: 'public_channel,private_channel,mpim,im',
  };

  return channelTypeMap[type] || 'public_channel';
}
