import { ERROR_MESSAGES } from './constants';
import { ConfigurationError } from './errors';
import { ProfileConfigManager } from './profile-config';

/**
 * Helper function to get configuration with proper error handling
 */
export async function getConfigOrThrow(
  profile?: string,
  configManager: ProfileConfigManager = new ProfileConfigManager()
): Promise<{ token: string }> {
  // A token injected by a secret manager takes precedence so the CLI can run
  // without a token stored on disk (e.g. in sandboxed or CI environments).
  // An explicit --profile still selects the stored profile.
  const envToken = process.env.SLACK_CLI_TOKEN?.trim();
  if (envToken && !profile) {
    return { token: envToken };
  }

  const config = await configManager.getConfig(profile);

  if (!config) {
    const profiles = await configManager.listProfiles();
    const profileName = profile || profiles.find((p) => p.isDefault)?.name || 'default';
    throw new ConfigurationError(ERROR_MESSAGES.NO_CONFIG(profileName));
  }

  return config;
}
