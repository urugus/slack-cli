import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';

export interface BookmarkItem {
  type: string;
  channel: string;
  message: {
    text: string;
    ts: string;
  };
  date_create: number;
}

export interface BookmarkFormatterOptions {
  items: BookmarkItem[];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

class BookmarkTableFormatter extends AbstractFormatter<BookmarkFormatterOptions> {
  format({ items }: BookmarkFormatterOptions): void {
    const channelWidth = 16;
    const tsWidth = 20;
    const textWidth = 40;
    const savedAtWidth = 26;

    const header =
      'Channel'.padEnd(channelWidth) +
      'Timestamp'.padEnd(tsWidth) +
      'Text'.padEnd(textWidth) +
      'Saved At'.padEnd(savedAtWidth);
    console.log(header);
    console.log('\u2500'.repeat(channelWidth + tsWidth + textWidth + savedAtWidth));

    items.forEach((item) => {
      const channel = (item.channel || '').padEnd(channelWidth);
      const ts = (item.message?.ts || '').padEnd(tsWidth);
      const text = (item.message?.text || '').slice(0, textWidth - 2).padEnd(textWidth);
      const savedAt = formatDate(item.date_create).padEnd(savedAtWidth);

      console.log(`${channel}${ts}${text}${savedAt}`);
    });
  }
}

class BookmarkSimpleFormatter extends AbstractFormatter<BookmarkFormatterOptions> {
  format({ items }: BookmarkFormatterOptions): void {
    items.forEach((item) => {
      const savedAt = formatDate(item.date_create);
      console.log(`${item.channel}\t${item.message?.ts}\t${item.message?.text}\t${savedAt}`);
    });
  }
}

class BookmarkJsonFormatter extends JsonFormatter<BookmarkFormatterOptions> {
  protected transform({ items }: BookmarkFormatterOptions) {
    return items.map((item) => ({
      type: item.type,
      channel: item.channel,
      timestamp: item.message?.ts,
      text: item.message?.text,
      date_create: item.date_create,
      saved_at: formatDate(item.date_create),
    }));
  }
}

const bookmarkFormatterFactory = createFormatterFactory<BookmarkFormatterOptions>({
  table: new BookmarkTableFormatter(),
  simple: new BookmarkSimpleFormatter(),
  json: new BookmarkJsonFormatter(),
});

export function createBookmarkFormatter(format: string) {
  return bookmarkFormatterFactory.create(format);
}
