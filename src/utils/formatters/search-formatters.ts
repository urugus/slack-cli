import chalk from 'chalk';
import { AbstractFormatter, JsonFormatter, createFormatterFactory } from './base-formatter';
import { SearchMatch } from '../slack-api-client';

export interface SearchFormatterOptions {
  query: string;
  matches: SearchMatch[];
  totalCount: number;
  page: number;
  pageCount: number;
}

function formatTimestamp(slackTimestamp: string): string {
  const timestamp = parseFloat(slackTimestamp);
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

class TableSearchFormatter extends AbstractFormatter<SearchFormatterOptions> {
  format(options: SearchFormatterOptions): void {
    const { query, matches, totalCount, page, pageCount } = options;

    console.log(chalk.bold(`\nSearch results for "${query}" (${totalCount} matches)`));

    if (matches.length === 0) {
      console.log(chalk.yellow('No messages found'));
      return;
    }

    if (pageCount > 1) {
      console.log(chalk.gray(`Page ${page}/${pageCount}`));
    }

    console.log('');
    matches.forEach((match) => {
      const channel = match.channel.name ? `#${match.channel.name}` : match.channel.id || 'unknown';
      const username = match.username || match.user || 'Unknown';
      const timestamp = match.ts ? formatTimestamp(match.ts) : '';

      console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.blue(channel)} ${chalk.cyan(username)}`);
      console.log(match.text || '(no text)');
      if (match.permalink) {
        console.log(chalk.gray(match.permalink));
      }
      console.log('');
    });

    console.log(chalk.green(`Displayed ${matches.length} of ${totalCount} match(es)`));
  }
}

class SimpleSearchFormatter extends AbstractFormatter<SearchFormatterOptions> {
  format(options: SearchFormatterOptions): void {
    const { matches, totalCount } = options;

    if (matches.length === 0) {
      console.log('No messages found');
      return;
    }

    matches.forEach((match) => {
      const channel = match.channel.name ? `#${match.channel.name}` : match.channel.id || 'unknown';
      const username = match.username || match.user || 'Unknown';
      const timestamp = match.ts ? formatTimestamp(match.ts) : '';
      const text = match.text || '(no text)';
      console.log(`[${channel}] ${username} (${timestamp}): ${text}`);
    });

    if (totalCount > matches.length) {
      console.log(`... and ${totalCount - matches.length} more match(es)`);
    }
  }
}

class JsonSearchFormatter extends JsonFormatter<SearchFormatterOptions> {
  protected transform(options: SearchFormatterOptions) {
    const { query, matches, totalCount, page, pageCount } = options;

    return {
      query,
      totalCount,
      page,
      pageCount,
      matches: matches.map((match) => ({
        channel: match.channel.name || match.channel.id || 'unknown',
        username: match.username || match.user || 'Unknown',
        timestamp: match.ts ? formatTimestamp(match.ts) : '',
        text: match.text || '(no text)',
        permalink: match.permalink || '',
      })),
    };
  }
}

const searchFormatterFactory = createFormatterFactory<SearchFormatterOptions>({
  table: new TableSearchFormatter(),
  simple: new SimpleSearchFormatter(),
  json: new JsonSearchFormatter(),
});

export function createSearchFormatter(format: string) {
  return searchFormatterFactory.create(format);
}
