import { ProfileConfigManager } from './profile-config';
import { ConfigurationError } from './errors';
import { ERROR_MESSAGES } from './constants';

/**
 * Helper function to get configuration with proper error handling
 */
export async function getConfigOrThrow(
  profile?: string,
  configManager: ProfileConfigManager = new ProfileConfigManager()
): Promise<{ token: string }> {
  const config = await configManager.getConfig(profile);

  if (!config) {
    const profiles = await configManager.listProfiles();
    const profileName = profile || profiles.find((p) => p.isDefault)?.name || 'default';
    throw new ConfigurationError(ERROR_MESSAGES.NO_CONFIG(profileName));
  }

  return config;
}
