import chalk from 'chalk';
import { ProfileConfigManager } from '../utils/profile-config';
import { getProfileName } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';

export async function handleSetToken(options: { token: string; profile?: string }): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profileName = await getProfileName(configManager, options.profile);
  await configManager.setToken(options.token, options.profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.TOKEN_SAVED(profileName)}`));
}

export async function handleGetConfig(options: { profile?: string }): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profileName = await getProfileName(configManager, options.profile);
  const currentConfig = await configManager.getConfig(options.profile);

  if (!currentConfig) {
    console.log(chalk.yellow(ERROR_MESSAGES.NO_CONFIG(profileName)));
    return;
  }

  console.log(chalk.bold(`Configuration for profile "${profileName}":`));
  console.log(`  Token: ${chalk.cyan(configManager.maskToken(currentConfig.token))}`);
  console.log(`  Updated: ${chalk.gray(currentConfig.updatedAt)}`);
}

export async function handleListProfiles(): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profiles = await configManager.listProfiles();
  const currentProfile = await configManager.getCurrentProfile();

  if (profiles.length === 0) {
    console.log(chalk.yellow(ERROR_MESSAGES.NO_PROFILES_FOUND));
    return;
  }

  console.log(chalk.bold('Available profiles:'));
  profiles.forEach((profile) => {
    const marker = profile.name === currentProfile ? '*' : ' ';
    const maskedToken = configManager.maskToken(profile.config.token);
    console.log(`  ${marker} ${chalk.cyan(profile.name)} (${maskedToken})`);
  });
}

export async function handleUseProfile(profile: string): Promise<void> {
  const configManager = new ProfileConfigManager();
  await configManager.useProfile(profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_SWITCHED(profile)}`));
}

export async function handleShowCurrentProfile(): Promise<void> {
  const configManager = new ProfileConfigManager();
  const currentProfile = await configManager.getCurrentProfile();
  console.log(chalk.bold(`Current profile: ${chalk.cyan(currentProfile)}`));
}

export async function handleClearConfig(options: { profile?: string }): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profileName = await getProfileName(configManager, options.profile);
  await configManager.clearConfig(options.profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_CLEARED(profileName)}`));
}
