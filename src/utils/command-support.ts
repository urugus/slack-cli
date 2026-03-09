import { createSlackClient } from './client-factory';
import { parseFormat, parseProfile } from './option-parsers';
import { SlackApiClient } from './slack-api-client';
import { sanitizeTerminalData } from './terminal-sanitizer';

interface ProfileOption {
  profile?: string;
}

interface FormatOption {
  format?: string;
}

interface FormatRenderers<T> {
  table: (data: T) => void;
  simple?: (data: T) => void;
  json?: (data: T) => void;
}

export async function withSlackClient<TOptions extends ProfileOption, TResult>(
  options: TOptions,
  action: (client: SlackApiClient) => Promise<TResult>
): Promise<TResult> {
  const profile = parseProfile(options.profile);
  const client = await createSlackClient(profile);

  return await action(client);
}

export function renderByFormat<T>(
  options: FormatOption,
  data: T,
  renderers: FormatRenderers<T>
): void {
  const format = parseFormat(options.format);

  if (format === 'json') {
    if (renderers.json) {
      renderers.json(data);
      return;
    }

    console.log(JSON.stringify(sanitizeTerminalData(data), null, 2));
    return;
  }

  if (format === 'simple' && renderers.simple) {
    renderers.simple(data);
    return;
  }

  renderers.table(data);
}
