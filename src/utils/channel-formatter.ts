import { Channel } from './slack-api-client';

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
    created: new Date(channel.created * 1000).toISOString().split('T')[0],
    purpose: channel.purpose?.value || '',
  };
}

export function formatChannelsAsTable(channels: ChannelInfo[]): void {
  // Print table header
  console.log('Name              Type      Members  Created      Description');
  console.log('─'.repeat(65));

  // Print channel rows
  channels.forEach((channel) => {
    const name = channel.name.padEnd(17);
    const type = channel.type.padEnd(9);
    const members = channel.members.toString().padEnd(8);
    const created = channel.created.padEnd(12);
    const purpose =
      channel.purpose.length > 30 ? channel.purpose.substring(0, 27) + '...' : channel.purpose;

    console.log(`${name} ${type} ${members} ${created} ${purpose}`);
  });
}

export function formatChannelsAsSimple(channels: ChannelInfo[]): void {
  channels.forEach((channel) => console.log(channel.name));
}

export function formatChannelsAsJson(channels: ChannelInfo[]): void {
  console.log(
    JSON.stringify(
      channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        members: channel.members,
        created: channel.created + 'T00:00:00Z',
        purpose: channel.purpose,
      })),
      null,
      2
    )
  );
}

export function getChannelTypes(type: string): string {
  switch (type) {
    case 'public':
      return 'public_channel';
    case 'private':
      return 'private_channel';
    case 'im':
      return 'im';
    case 'mpim':
      return 'mpim';
    case 'all':
      return 'public_channel,private_channel,mpim,im';
    default:
      return 'public_channel';
  }
}
