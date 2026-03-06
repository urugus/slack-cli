import chalk from 'chalk';
import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { ChannelDetail } from '../slack-api-client';
import { sanitizeTerminalText } from '../terminal-sanitizer';

export interface ChannelInfoFormatterOptions {
  channel: ChannelDetail;
}

class TableChannelInfoFormatter extends AbstractFormatter<ChannelInfoFormatterOptions> {
  format(options: ChannelInfoFormatterOptions): void {
    const { channel } = options;
    const name = sanitizeTerminalText(channel.name);
    const topic = sanitizeTerminalText(channel.topic?.value || '(not set)');
    const purpose = sanitizeTerminalText(channel.purpose?.value || '(not set)');

    console.log(chalk.bold(`\nChannel Info: #${name}`));
    console.log('');
    console.log(`  ${chalk.gray('ID:')}       ${channel.id}`);
    console.log(`  ${chalk.gray('Name:')}     ${name}`);
    console.log(`  ${chalk.gray('Private:')}  ${channel.is_private ? 'Yes' : 'No'}`);
    console.log(`  ${chalk.gray('Archived:')} ${channel.is_archived ? 'Yes' : 'No'}`);
    if (channel.num_members !== undefined) {
      console.log(`  ${chalk.gray('Members:')}  ${channel.num_members}`);
    }
    console.log(
      `  ${chalk.gray('Created:')}  ${new Date(channel.created * 1000).toLocaleDateString()}`
    );
    console.log('');
    console.log(`  ${chalk.gray('Topic:')}    ${topic}`);
    console.log(`  ${chalk.gray('Purpose:')}  ${purpose}`);
    console.log('');
  }
}

class SimpleChannelInfoFormatter extends AbstractFormatter<ChannelInfoFormatterOptions> {
  format(options: ChannelInfoFormatterOptions): void {
    const { channel } = options;
    const name = sanitizeTerminalText(channel.name);
    const topic = sanitizeTerminalText(channel.topic?.value || '(not set)');
    const purpose = sanitizeTerminalText(channel.purpose?.value || '(not set)');

    console.log(`${name} (${channel.id})`);
    console.log(`Topic: ${topic}`);
    console.log(`Purpose: ${purpose}`);
    if (channel.num_members !== undefined) {
      console.log(`Members: ${channel.num_members}`);
    }
  }
}

class JsonChannelInfoFormatter extends JsonFormatter<ChannelInfoFormatterOptions> {
  protected transform(options: ChannelInfoFormatterOptions) {
    const { channel } = options;
    return {
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
      is_archived: channel.is_archived ?? false,
      created: channel.created,
      num_members: channel.num_members,
      topic: channel.topic?.value || null,
      purpose: channel.purpose?.value || null,
    };
  }
}

const channelInfoFormatterFactory = createFormatterFactory<ChannelInfoFormatterOptions>({
  table: new TableChannelInfoFormatter(),
  simple: new SimpleChannelInfoFormatter(),
  json: new JsonChannelInfoFormatter(),
});

export function createChannelInfoFormatter(format: string) {
  return channelInfoFormatterFactory.create(format);
}
