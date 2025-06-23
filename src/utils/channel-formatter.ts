import { Channel } from './slack-api-client';
import { formatUnixTimestamp } from './date-utils';

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
    name: channel.name || 'unnamed',
    type,
    members: channel.num_members || 0,
    created: formatUnixTimestamp(channel.created),
    purpose: channel.purpose?.value || '',
  };
}

export function formatChannelName(channelName?: string): string {
  if (!channelName) return '#unknown';
  return channelName.startsWith('#') ? channelName : `#${channelName}`;
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
