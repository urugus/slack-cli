import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { ChannelInfo } from '../channel-formatter';

export interface ChannelsListFormatterOptions {
  channels: ChannelInfo[];
}

class ChannelsTableFormatter extends AbstractFormatter<ChannelsListFormatterOptions> {
  format({ channels }: ChannelsListFormatterOptions): void {
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

class ChannelsSimpleFormatter extends AbstractFormatter<ChannelsListFormatterOptions> {
  format({ channels }: ChannelsListFormatterOptions): void {
    channels.forEach((channel) => console.log(channel.name));
  }
}

class ChannelsJsonFormatter extends JsonFormatter<ChannelsListFormatterOptions> {
  protected transform({ channels }: ChannelsListFormatterOptions) {
    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      members: channel.members,
      created: channel.created + 'T00:00:00Z',
      purpose: channel.purpose,
    }));
  }
}

const channelsListFormatterFactory = createFormatterFactory<ChannelsListFormatterOptions>({
  table: new ChannelsTableFormatter(),
  simple: new ChannelsSimpleFormatter(),
  json: new ChannelsJsonFormatter(),
});

export function createChannelsListFormatter(format: string) {
  return channelsListFormatterFactory.create(format);
}
