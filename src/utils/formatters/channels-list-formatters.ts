import { BaseFormatter } from './output-formatter';
import { ChannelInfo } from '../channel-formatter';

export class ChannelsTableFormatter extends BaseFormatter<ChannelInfo> {
  format(channels: ChannelInfo[]): void {
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
}

export class ChannelsSimpleFormatter extends BaseFormatter<ChannelInfo> {
  format(channels: ChannelInfo[]): void {
    channels.forEach((channel) => console.log(channel.name));
  }
}

export class ChannelsJsonFormatter extends BaseFormatter<ChannelInfo> {
  format(channels: ChannelInfo[]): void {
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
}

export function createChannelsListFormatter(format: string): BaseFormatter<ChannelInfo> {
  switch (format) {
    case 'json':
      return new ChannelsJsonFormatter();
    case 'simple':
      return new ChannelsSimpleFormatter();
    case 'table':
    default:
      return new ChannelsTableFormatter();
  }
}
