import { getConfigOrThrow } from './config-helper';
import { SlackApiClient } from './slack-api-client';

/**
 * Creates a SlackApiClient instance with configuration from the specified profile
 */
export async function createSlackClient(profile?: string): Promise<SlackApiClient> {
  const config = await getConfigOrThrow(profile);
  return new SlackApiClient(config.token);
}
